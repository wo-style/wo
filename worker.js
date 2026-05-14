import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

const dbMethods = {
    init: (db, { limit } = {}) => {
        return {
            sentencesExample: dbMethods.getItems(db, { type: "sentence_example", limit }),
            nounsFavorite: dbMethods.getItems(db, { type: "noun_favorite" }),
            verbsFavorite: dbMethods.getItems(db, { type: "verb_favorite" }),
            sentencesFavorite: dbMethods.getItems(db, { type: "sentence_favorite" }),
            generateSentences: dbMethods.generateSentences(db, { limit }),
        };
    },
    getItems: (db, { type, limit, search } = {}) => {
        let items;
        switch (type) {
            case "sentence_example":
                const maxId = db.selectValue("SELECT MAX(id) FROM wo");
                const randomIds = [];
                for (let i = 0; i < limit; i++) {
                    randomIds.push(Math.floor(Math.random() * maxId) + 1);
                }
                items = db.selectArrays(`SELECT noun, verb FROM wo WHERE id IN (${randomIds.join(",")})`);
                break;
            case "noun_favorite":
                items = db.selectArrays("SELECT word FROM noun ORDER BY ROWID DESC");
                break;
            case "verb_favorite":
                items = db.selectArrays("SELECT word FROM verb ORDER BY ROWID DESC");
                break;
            case "sentence_favorite":
                items = db.selectArrays("SELECT noun, verb FROM sentence ORDER BY ROWID DESC");
                break;
            default:
                throw new Error(`不正なテーブルです： ${type}`);
        }
        return { type, items };
    },
    searchSentences: (db, { word }) => {
        const items = db.selectArrays(
            `SELECT noun, verb FROM wo WHERE noun LIKE ? OR verb LIKE ? ORDER BY count DESC LIMIT 300`,
            [`%${word}%`, `%${word}%`],
        );
        return { type: "searchSentences_result", items };
    },
    saveSentence: (db, { noun, verb }) => {
        db.exec("INSERT OR IGNORE INTO sentence (noun, verb) VALUES (?, ?)", {
            bind: [noun, verb],
        });
        return { type: "sentence_favorite", noun, verb };
    },
    saveWord: (db, { type, word }) => {
        db.exec(`INSERT OR IGNORE INTO ${type} (word) VALUES (?)`, {
            bind: [word],
        });
        return { type: `${type}_favorite`, word };
    },
    deleteSentence: (db, { noun, verb }) => {
        db.exec("DELETE FROM sentence WHERE noun = ? AND verb = ?", {
            bind: [noun, verb],
        });
        return { type: "sentence_favorite", noun, verb };
    },
    deleteWord: (db, { type, word }) => {
        db.exec(`DELETE FROM ${type} WHERE word = ?`, {
            bind: [word],
        });
        return { type: `${type}_favorite`, word };
    },
    generateSentences: (db, { limit } = {}) => {
        const nouns = db.selectArrays("SELECT word FROM noun ORDER BY RANDOM() LIMIT " + limit);
        const verbs = db.selectArrays("SELECT word FROM verb ORDER BY RANDOM() LIMIT " + limit);
        const items = [];
        const count = Math.min(nouns.length, verbs.length);
        for (let i = 0; i < count; i++) {
            items.push([nouns[i][0], verbs[i][0]]);
        }
        return { items };
    },
    generateSentencesWithRandom: (db, { limit } = {}) => {
        const maxId = db.selectValue("SELECT MAX(id) FROM wo");
        const nounIds = [];
        const verbIds = [];
        for (let i = 0; i < limit; i++) {
            nounIds.push(Math.floor(Math.random() * maxId) + 1);
            verbIds.push(Math.floor(Math.random() * maxId) + 1);
        }
        const nouns = db.selectArrays(`SELECT noun FROM wo WHERE id IN (${nounIds.join(",")})`);
        const verbs = db.selectArrays(`SELECT verb FROM wo WHERE id IN (${verbIds.join(",")})`);
        const items = [];
        const count = Math.min(nouns.length, verbs.length);
        for (let i = 0; i < count; i++) {
            items.push([nouns[i][0], verbs[i][0]]);
        }
        return { items };
    },
    generateSentencesWithWord: (db, { fixedTable, targetTable, fixedWord } = {}) => {
        const isFixedNoun = fixedTable === "noun";
        const rotateColumn = "word";
        const rotateQuery = targetTable === "verb" ? "SELECT word FROM verb" : "SELECT word FROM noun";
        const items = db.selectArrays(
            `SELECT ${isFixedNoun ? `?, ${rotateColumn}` : `${rotateColumn}, ?`} FROM (${rotateQuery})`,
            [fixedWord],
        );
        return { items, fixedTable, targetTable, fixedWord };
    },
};

let dbInstance;

const start = async (sqlite3) => {
    const filename = "wo.db";
    try {
        const root = await navigator.storage.getDirectory();
        console.log("OPFSのデータベースを確認します...");
        const fileHandle = await root.getFileHandle(filename).catch(() => null);
        if (!fileHandle) {
            await root.removeEntry(filename).catch(() => null);
            console.log("OPFSにデータベースは存在しませんでした");
            console.log("データベースをダウンロードします...");
            const DB_URL = "https://db.wo.style/wo.db";
            const response = await fetch(DB_URL, { cache: "no-store" });
            if (!response.ok) {
                throw new Error(`データベースのダウンロードに失敗しました： ${response.status}`);
            }
            const contentLength = +response.headers.get("Content-Length");
            const reader = response.body.getReader();
            const fileHandle = await root.getFileHandle(filename, { create: true });
            const accessHandle = await fileHandle.createSyncAccessHandle();
            try {
                accessHandle.truncate(0);
                let receivedLength = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    accessHandle.write(value);
                    receivedLength += value.length;
                    if (contentLength) {
                        const percentage = Math.round((receivedLength / contentLength) * 100);
                        postMessage({ type: "download_progress", result: percentage });
                    }
                }
                accessHandle.flush();
                console.log("データベースのダウンロードに成功しました");
                console.log("データベースをOPFSに保存しました");
            } finally {
                accessHandle.close();
            }
        }
        dbInstance = new sqlite3.oo1.OpfsDb("/" + filename);
        console.log("OPFSに接続しました");
        postMessage({ type: "ready" });
    } catch (err) {
        console.error("Workerでエラーが発生しました：", err.message);
        postMessage({ type: "error", result: { errorMessage: err.message, errorType: "INIT_FAILED" } });
    }
};

self.onmessage = async (e) => {
    const { action, payload } = e.data;
    if (!dbInstance) {
        postMessage({ type: "error", result: { errorMessage: "まだデータベースの用意ができていません" } });
        return;
    }
    const method = dbMethods[action];
    if (method) {
        try {
            const result = method(dbInstance, payload);
            postMessage({ type: `${action}_result`, result });
        } catch (err) {
            postMessage({ type: "error", relust: { errorMessage: err.message, errorType: "QUERY_FAILED" } });
        }
    }
};

const initSqliteWasm = async () => {
    postMessage({ type: "wasm_progress" });
    console.log("WASMをコンパイルしています...");
    const sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
    });
    await start(sqlite3);
};

initSqliteWasm();
