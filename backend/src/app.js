import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as tf from "@tensorflow/tfjs-node"; // CPUでも動かせるようになるらしい
import * as use from "@tensorflow-models/universal-sentence-encoder";

const app = express();
const model = await use.load();       // 一回だけロード

const previewWords = 30;

const ZERO_EMBED = JSON.stringify(Array(512).fill(0));


// POSTできたりするように（おまじない）
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== CORS (Render Frontendを許可) =====
const allowedOrigins = [
  "https://twogate-devcamp-st-2025-1.onrender.com", // ← フロントのURL
  "http://localhost:3001",                           // ← ローカル確認用（任意）
];
app.use(
  cors({
    origin: (origin, cb) => {
      // SSRやcurl等でoriginが無いケースも通す
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false, // 認証クッキー等を使わないならfalseでOK
  })
);
// Preflight（OPTIONS）も許可
 app.use(
   cors({ /* 省略 */ })
 );

// db
const db = new Database("./data/app.db"); // backendからみて
sqliteVec.load(db);

db.exec(`
	CREATE VIRTUAL TABLE IF NOT EXISTS memos USING vec0(
		id INTEGER PRIMARY KEY,
		title TEXT NOT NULL,
		created_date TEXT NOT NULL,
		accessed_at TEXT NOT NULL,
		content TEXT,
		embedding FLOAT[512]
	);
	create table if not exists memo_similarities (
		memo_id_1 INTEGER NOT NULL,
		memo_id_2 INTEGER NOT NULL,
		similarity_score real NOT NULL,
		created_time text NOT NULL,
		CHECK (memo_id_1 < memo_id_2),
		PRIMARY key (memo_id_1, memo_id_2)
	);
`)

// memosにベクトルを保存
function updateEmbedding(id, json) {
	db.prepare(
		`UPDATE memos
		SET embedding = :json
		WHERE id = :id`,
	).run({ id, json })
}

// 新しいメモのidのmemo_similaritiesを削除
function deleteSimilaritiesFor(id) {
	db.prepare(
		`DELETE FROM memo_similarities WHERE memo_id_1 = :id OR memo_id_2 = :id`
	).run({ id });
}

// 新しいメモと既存のすべてのメモとの距離を計算、memo_similaritiesに保存
function insertSimilaritiesFor(id, json) {
	db.prepare(`
		INSERT INTO memo_similarities (memo_id_1, memo_id_2, similarity_score, created_time)
		SELECT
			MIN(:id, memos.id),
			MAX(:id, memos.id),
			1.0 - vec_distance_cosine(memos.embedding, :json) AS similarity_score, -- コサイン類似度として保存
			strftime('%Y-%m-%dT%H:%M:%S', 'now') AS created_time -- 日付と時刻の区切りがT
		FROM memos
		WHERE
			memos.id != :id
			AND memos.embedding IS NOT NULL
			AND (1.0 - vec_distance_cosine(memos.embedding, :json)) >= 0.6
		LIMIT 5
	`).run({ id, json })
}

const jstDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

// 新規作成・更新時に計算する
async function calcSimilarities(id, content) {
	// メモのベクトル化
	const newMemoVector = await model.embed([content]);
	const vec = (await newMemoVector.array())[0]; // JSON化できるように配列に直す
	newMemoVector.dispose(); // メモリ解放
	const jsonVec = JSON.stringify(vec);

	updateEmbedding(id, jsonVec); 	
	deleteSimilaritiesFor(id); 
	insertSimilaritiesFor(id, jsonVec);
}

// listen開始
 const PORT = process.env.PORT || 3000;
 app.listen(PORT, () => console.log(`server on ${PORT}`));

// test
app.get("/", (req, res) => {
	res.send("welcome"); 
})

// 全メモ取得 vector_data以外
app.get("/api/memos", (req, res) => {
	try {
		const sql = `
			SELECT
				id,
				title,
				accessed_at,
				created_date,
				substr(content, 1, :previewWords) AS preview
			FROM memos
		`;
		const rows = db.prepare(sql).all({ previewWords });
		res.json(rows);
	} catch (err) {
		console.error("database error:", err.message);
		res.status(500).json({ error: "failed to fetch memos." });
	}
});

// 類似メモ取得、memo_similarities tableから
// 単一メモ取得（id, title, content, ...）
app.get("/api/memos/:id/", (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "bad id" });
	try {
		const row = db.prepare(`
			SELECT id, title, content, accessed_at, created_date
			FROM memos WHERE id = ?
		`).get(id);
		if (!row) return res.status(404).json({ error: "not found" });
		res.json({ note: row });
	} catch (e) {
		res.status(500).json({ error: "failed to fetch memo" });
	}
});

// メモ作成
// 性能をあげたくなったらメモを段落ごとに分割するようにする
app.post("/api/memos", async (req, res) => {

	const { title, content, created_date } = req.body;
	if (!title) return res.status(400).json({ error: "title required" });
	if (!content) return res.status(400).json({ error: "content required" });

	const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

	// embeddingをnullにはできないため、初期化しておく
	const info = db.prepare(`
		INSERT 
			INTO memos (title, content, created_date, accessed_at, embedding) 
			VALUES (?, ?, ?, ?, ?)
	`).run(title, content, created_date ?? jstDate(), now, ZERO_EMBED);

	const id = Number(info.lastInsertRowid);
	await calcSimilarities(id, content);
	res.status(201).json({ id });
})

// メモ更新、何もなければaccessed_atのみ更新
app.patch ("/api/memos/:id", async(req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Bad id"});

	try {
		const updates = [];
		const params = {};

		// リクエスト箇所のみSQL文に追加
		const fields = ["title", "content", "created_date"];
		fields.forEach(field => {
			if(req.body[field] !== undefined) { // 空文字もOKにする
				updates.push(`${field} = :${field}`);
				params[field] = req.body[field];
			}
		})

		updates.push("accessed_at = :accessed_at");
		params.accessed_at = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
		params.id = id;

		const result = db.prepare(`
			UPDATE memos
			SET ${updates.join(", ")}
			WHERE id = :id
		`).run(params);

		if (result.changes === 0) return res.status(404).json({ error: "Memo not found"});

		// contentが修正されたとき類似度を再計算
		if (params.content)	await calcSimilarities(id, params.content);

		return res.status(200).json({ message: "Memo updated successfully."});

	} catch (e) {
		res.status(500).json({ error: "Failed to update memo"})
	}
})

// メモ削除
app.delete("/api/memos/:id", (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "bad id"});

	const delMemo = db.transaction((memoId) => {
		// memo_similaritiesの該当部分を削除
		db.prepare(`
			DELETE FROM memo_similarities
			WHERE memo_id_1 = :id OR memo_id_2 = :id
		`).run({ id: memoId });
		// memosのidを削除
		const r = db.prepare("DELETE FROM memos WHERE id = :id").run({ id: memoId });
		return r.changes;
	});

	const changes =	delMemo(id);
	if (changes === 0) return res.status(404).json({ error: "memo not found" });

	return res.status(204).end();
})

// 検索
app.get("/api/search", (req, res) => {
	try {
		const { searchWord } = req.query;
		if (!searchWord) return res.status(400).json({ error: "Search query 'searchWord' is required." })

		let kw = searchWord.replace(/[%_]/g, "\\$&") // %,_にバックスラッシュを1つくっつける
		kw = `%${kw}%` // 曖昧検索のために前後に%をつける

		if (!searchWord) return res.status(400).json({ error: "Search query 'q' is required." })

		const rows = db.prepare(`
			SELECT
				id,
				title,
				substr(content, 1, :previewWords) AS preview
			FROM memos
			WHERE title LIKE :kw
				OR content LIKE :kw
			ORDER BY created_date DESC, id DESC -- 適当、将来的に関連度順に
			LIMIT 10
		`).all({ previewWords, kw });

		res.json(rows);
	} catch (e) {
		res.status(500).json({ error: e.message });
	}
})

// graph データを全て
app.get("/api/graph", (req, res) => {
	try {
		// memo_similaritiesを全て出力
		// 多過ぎたら後で閾値を設ける
		const links = db.prepare(`
			SELECT 
				memo_id_1 AS source,
				memo_id_2 AS target,
				similarity_score AS value
			FROM memo_similarities
			-- WHERE similarity_score >= 0.7
			ORDER by similarity_score DESC
			LIMIT 5
		`).all()

		// memo_idの取得
		const memoIds = new Set();
		links.forEach(link => {
			memoIds.add(link.source);
			memoIds.add(link.target);
		})
		const idsArray = Array.from(memoIds);

		const nodes = db.prepare(`
			SELECT
				id,
				title,
				created_date,
				substr(content, 1, :previewWords) AS preview
			FROM memos
			WHERE id IN (${idsArray.join(",")})
		`).all({ previewWords })

		res.json({ nodes, links });
	} catch(e) {
		res.status(500).json({ error: "Failed to fetch graph data"})
	};
})
