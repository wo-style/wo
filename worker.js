import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

const CURRENT_DB_VERSION = 1;

const dbMethods = {
    getItems: (db, { type, limit } = {}) => {
        let items;
        switch (type) {
            case "sentence_example": {
                const maxId = db.selectValue("SELECT MAX(id) FROM verb_example");
                const uniqueIds = new Set();
                while (uniqueIds.size < limit) {
                    uniqueIds.add(Math.floor(Math.random() * maxId) + 1);
                }
                const randomVerbIds = Array.from(uniqueIds);
                const placeholders = randomVerbIds.map(() => "?").join(",");
                items = db.selectArrays(
                    `
                    WITH target_pairs AS (
                        SELECT verb_id, noun_id,
                               ROW_NUMBER() OVER(PARTITION BY verb_id ORDER BY RANDOM()) as rn
                        FROM sentence_example
                        WHERE verb_id IN (${placeholders})
                    )
                    SELECT ne.word, ve.word
                    FROM target_pairs tp
                    JOIN noun_example ne ON tp.noun_id = ne.id
                    JOIN verb_example ve ON tp.verb_id = ve.id
                    WHERE tp.rn = 1
                    `,
                    randomVerbIds,
                );
                break;
            }
            case "noun_favorite":
                items = db.selectArrays("SELECT word FROM noun ORDER BY ROWID DESC");
                break;
            case "verb_favorite":
                items = db.selectArrays("SELECT word FROM verb ORDER BY ROWID DESC");
                break;
            case "sentence_favorite":
                items = db.selectArrays("SELECT noun, verb FROM sentence ORDER BY ROWID DESC");
                break;
        }
        return { type, items };
    },
    searchSentences: (db, { word }) => {
        const items = db.selectArrays(
            `
            SELECT ne.word, ve.word
            FROM sentence_example se
            JOIN noun_example ne ON se.noun_id = ne.id
            JOIN verb_example ve ON se.verb_id = ve.id
            WHERE ne.word LIKE ? OR ve.word LIKE ?
            ORDER BY se.count DESC LIMIT 300
        `,
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
    generateSentencesWithRandomByFavorites: (db, { limit } = {}) => {
        const nouns = db.selectArrays("SELECT word FROM noun ORDER BY RANDOM() LIMIT " + limit);
        const verbs = db.selectArrays("SELECT word FROM verb ORDER BY RANDOM() LIMIT " + limit);
        const items = [];
        const count = Math.min(nouns.length, verbs.length);
        for (let i = 0; i < count; i++) {
            items.push([nouns[i][0], verbs[i][0]]);
        }
        return { items };
    },
    generateSentencesWithRandomByExamples: (db, { limit } = {}) => {
        const nouns = db.selectArrays("SELECT word FROM noun_example ORDER BY RANDOM() LIMIT ?", [limit]);
        const verbs = db.selectArrays("SELECT word FROM verb_example ORDER BY RANDOM() LIMIT ?", [limit]);
        const items = [];
        const actualLimit = Math.min(nouns.length, verbs.length);
        for (let i = 0; i < actualLimit; i++) {
            items.push([nouns[i][0], verbs[i][0]]);
        }
        return { items };
    },
    generateSentencesWithWordByFavorites: (db, { fixedTable, targetTable, fixedWord } = {}) => {
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

dbMethods.init = (db, { limit } = {}) => {
    const sentencesExample = dbMethods.getItems(db, { type: "sentence_example", limit });
    const nounsFavorite = dbMethods.getItems(db, { type: "noun_favorite" });
    const verbsFavorite = dbMethods.getItems(db, { type: "verb_favorite" });
    const sentencesFavorite = dbMethods.getItems(db, { type: "sentence_favorite" });
    const generateSentences = dbMethods.generateSentencesWithRandomByFavorites(db, { limit });

    return {
        sentencesExample,
        nounsFavorite,
        verbsFavorite,
        sentencesFavorite,
        generateSentences,
    };
};

const downloadDbToOpfs = async (root, filename, dburl) => {
    console.log("データベースをダウンロードします...");
    await root.removeEntry(filename).catch(() => null);
    const response = await fetch(dburl, { cache: "no-store" });
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
};

const backupFavorites = (db) => {
    console.log("お気に入りデータを退避します...");
    return {
        nouns: db.selectArrays("SELECT word FROM noun"),
        verbs: db.selectArrays("SELECT word FROM verb"),
        sentences: db.selectArrays("SELECT noun, verb FROM sentence"),
    };
};

const restoreFavorites = (db, backup) => {
    console.log("お気に入りデータを復元します...");
    db.exec("BEGIN TRANSACTION;");
    try {
        db.exec("DELETE FROM noun;");
        db.exec("DELETE FROM verb;");
        db.exec("DELETE FROM sentence;");

        const insertNoun = db.prepare("INSERT OR IGNORE INTO noun (word) VALUES (?)");
        backup.nouns.forEach((row) => {
            insertNoun.bind([row[0]]);
            insertNoun.step();
            insertNoun.reset();
        });
        insertNoun.finalize();

        const insertVerb = db.prepare("INSERT OR IGNORE INTO verb (word) VALUES (?)");
        backup.verbs.forEach((row) => {
            insertVerb.bind([row[0]]);
            insertVerb.step();
            insertVerb.reset();
        });
        insertVerb.finalize();

        const insertSentence = db.prepare("INSERT OR IGNORE INTO sentence (noun, verb) VALUES (?, ?)");
        backup.sentences.forEach((row) => {
            insertSentence.bind([row[0], row[1]]);
            insertSentence.step();
            insertSentence.reset();
        });
        insertSentence.finalize();

        db.exec("COMMIT;");
        console.log("お気に入りデータの復元に成功しました");
    } catch (e) {
        db.exec("ROLLBACK;");
        console.error("お気に入りデータの復元に失敗しました:", e);
    }
};

let dbInstance;

const start = async (sqlite3) => {
    const filename = "wo.db";
    const dburl = "https://db.wo.style/wo.db";
    try {
        const root = await navigator.storage.getDirectory();
        console.log("OPFSのデータベースを確認します...");
        const fileHandle = await root.getFileHandle(filename).catch(() => null);
        if (!fileHandle) {
            console.log("OPFSにデータベースは存在しませんでした");
            await downloadDbToOpfs(root, filename, dburl);
        } else {
            const tempDb = new sqlite3.oo1.OpfsDb("/" + filename);
            const userVersion = tempDb.selectValue("PRAGMA user_version");
            console.log(`データベースのバージョンは ${userVersion} です`);

            tempDb.close();

            if (userVersion < CURRENT_DB_VERSION) {
                console.log(`データベースを ${CURRENT_DB_VERSION} にバージョンアップします...`);
                const oldDb = new sqlite3.oo1.OpfsDb("/" + filename);
                const backupData = backupFavorites(oldDb);
                oldDb.close();

                await downloadDbToOpfs(root, filename, dburl);

                const newDb = new sqlite3.oo1.OpfsDb("/" + filename);
                restoreFavorites(newDb, backupData);
                newDb.close();
            }
        }

        dbInstance = new sqlite3.oo1.OpfsDb("/" + filename);

        const currentVersion = dbInstance.selectValue("PRAGMA user_version");
        if (currentVersion < CURRENT_DB_VERSION) {
            dbInstance.exec(`PRAGMA user_version = ${CURRENT_DB_VERSION};`);
            console.log(`データベースのバージョンを ${CURRENT_DB_VERSION} に設定しました`);
        }

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
        postMessage({
            type: "error",
            result: { errorMessage: "まだデータベースの初期化前です", errorType: "DB_FAILED" },
        });
        return;
    }
    const method = dbMethods[action];
    if (method) {
        try {
            const result = method(dbInstance, payload);
            postMessage({ type: `${action}_result`, result });
        } catch (err) {
            postMessage({ type: "error", result: { errorMessage: err.message, errorType: "QUERY_FAILED" } });
        }
    }
};

const initSqliteWasm = async () => {
    postMessage({ type: "wasm_progress" });
    console.log("sqliteWasmの準備をしています...");
    const sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
    });
    await start(sqlite3);
};

initSqliteWasm();
