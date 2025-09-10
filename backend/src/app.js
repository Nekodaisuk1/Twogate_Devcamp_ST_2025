import express from "express";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import * as tf from "@tensorflow/tfjs-node"; // CPUでも動かせるようになるらしい
import * as use from "@tensorflow-models/universal-sentence-encoder";

const app = express();

const model = await use.load();       // 一回だけロード

// POSTできたりするように（おまじない）
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// db
const db = new Database("../data/app.db");
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
		memo_id_1 integer not null,
		memo_id_2 integer not null,
		similarity_score real not null,
		created_time text not null,
		check (memo_id_1 < memo_id_2),
		primary key (memo_id_1, memo_id_2),
		foreign key (memo_id_1) references memos(id),
		foreign key (memo_id_2) references memos(id)
	);
`)

// memosにベクトルを保存
function updateEmbedding(id, json) {
	db.prepare(
		`UPDATE memos
		SET embedding = vector(:json)
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
			1.0 - vec_distance_cosine(memos.embedding, vector(:json)) AS similarity_score, -- コサイン類似度として保存
			strftime('%Y-%m-%dT%H:%M:%S', 'now') AS created_time -- 日付と時刻の区切りがT
		FROM memos
		WHERE
			memos.id != :id AND (1.0 - vec_distance_cosine(memos.embedding,vector(:json))) >= 0.6
	`).run({ id, json })
}

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
app.listen(3000, () => {
	console.log("Start server on port 3000.");
});

// test
app.get("/", (req, res) => {
	res.send("welcome"); 
})

// 全メモ取得 vector_data以外
app.get("/api/memos", (req, res) => {
	try {
		const sql = "SELECT id, title, accessed_at, created_date FROM memos";
		// これに追加で、contentの何文字かをpreviewとして取得するようにする
		const rows = db.prepare(sql).all();
		res.json(rows);
	} catch (err) {
		console.error("database error:", err.message);
		res.status(500).json({ error: "failed to fetch memos." });
	}
});

// 類似メモ取得、memo_similarities tableから
app.get("/api/memos/:id/", (req, res) => {
	const id = Number(req.params.id);
	const sql = `
		SELECT 
		  CASE WHEN memo_id_1 = :id THEN memo_id_2 ELSE memo_id_1 END AS similarity_memo_ids,
		  similarity_score
		FROM memo_similarities
		WHERE memo_id_1 = :id OR memo_id_2 = :id
		ORDER BY similarity_score DESC -- 降順
	`;

	const rows = db.prepare(sql).all({ id })
	res.json(rows);
})

// メモ作成
// 性能をあげたくなったらメモを段落ごとに分割するようにする
app.post("/api/memos", async (req, res) => {

	const { title, content, created_date } = req.body;
	if (!title) return res.status(400).json({ error: "title required" });

	const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

	const sql = "INSERT INTO memos (title, content, create_date, accessed_at) VALUES (?, ?, ?, ?)";
	const info = db.prepare( sql ).run(title, content, created_date, now);

	await calcSimilarities(newMemoVector, id);
})

// メモ更新
app.patch("/api/memos/:id", (req, res) => {
})

// メモ削除
app.delete("/api/memos/:id", (req, res) => {
	// 今作ってる 2025/09/10の内に完成させる
})

// 検索
app.get("/api/search", (req, res) => {
})

// graphのデータで与える
app.get("/api/graph", (req, res) => {
})
