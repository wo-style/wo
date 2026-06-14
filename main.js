(() => {
    const loadingEl = document.getElementById("loading");

    // if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
    //     loadingEl.textContent = "※このページはPC専用です";
    //     return;
    // }

    if (!navigator.storage || !navigator.storage.getDirectory) {
        loadingEl.textContent = "※このブラウザはOPFSをサポートしていません。最新のブラウザを使用してください。";
        return;
    }

    const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });

    const statusEl = document.getElementById("status");
    const setStatus = (msg, type = null) => {
        if (type === null) {
            statusEl.style.color = "";
        } else if (type === "error") {
            statusEl.style.color = "red";
        }
        statusEl.textContent = msg;
    };

    const MODE = {
        SENTENCE_EXAMPLE: "sentence_example",
        NOUN_FAVORITE: "noun_favorite",
        VERB_FAVORITE: "verb_favorite",
        GENERATE: "generate",
        SENTENCE_FAVORITE: "sentence_favorite",
    };

    const createState = (name) => ({
        name,
        items: [],
        index: 0,
        page: 0,
        hasNext: false,
        lastAction: null,
        deleteds: new Set(),
    });

    const STATE = {
        [MODE.SENTENCE_EXAMPLE]: createState("例文"),
        [MODE.NOUN_FAVORITE]: createState("名詞"),
        [MODE.VERB_FAVORITE]: createState("動詞"),
        [MODE.SENTENCE_FAVORITE]: createState("名文"),
        [MODE.GENERATE]: createState("作文"),
    };

    // #app は 500×700px 固定。main 内側 540px / item 27px = 20 行ぴったり。
    const LIST_LENGTH_LIMIT = 20;
    document.getElementById("dummyLi").remove();

    const LIST_ELEMENTS = (() => {
        const listElements = {};
        Object.values(MODE).forEach((mode) => {
            const ul = document.getElementById(mode + "-list");
            const span = document.getElementById(mode + "-title").querySelector("span");
            const lists = [];
            for (let i = 0; i < LIST_LENGTH_LIMIT; i++) {
                const li = document.createElement("li");
                li.style.display = "none";
                ul.appendChild(li);
                lists.push(li);
            }
            listElements[mode] = { ul, lists, span, label: null };
        });
        return listElements;
    })();

    const { getMode, setMode, nextMode, prevMode } = (() => {
        const MODES = Object.values(MODE);

        let currentMode = null;
        let currentModeIndex = 0;

        return {
            getMode: () => {
                return currentMode;
            },
            setMode: (mode) => {
                if (!MODES.includes(mode)) return;
                currentMode = mode;
                currentModeIndex = MODES.indexOf(mode);
                document.querySelectorAll('[id$="-title"]').forEach((el) => {
                    el.classList.toggle("selected", el.id.includes(mode));
                });
                document.querySelectorAll('[id$="-list"]').forEach((el) => {
                    el.style.display = el.id.includes(mode) ? "" : "none";
                });
                const dls = document.querySelectorAll("header dl");
                dls.forEach((dl, index) => {
                    if (index === dls.length - 1 || dl.id.includes(mode)) {
                        dl.style.display = "inline-block";
                    } else {
                        dl.style.display = "none";
                    }
                });
                setStatus(`「${STATE[mode].name}」モードに変更しました`);
                console.log(`「${STATE[mode].name}」モードに変更しました`);
            },
            nextMode: () => {
                currentModeIndex = (currentModeIndex + 1) % MODES.length;
                setMode(MODES[currentModeIndex]);
            },
            prevMode: () => {
                currentModeIndex = (currentModeIndex - 1 + MODES.length) % MODES.length;
                setMode(MODES[currentModeIndex]);
            },
        };
    })();

    const escapeHTML = (str) => {
        if (!str) return "";
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    };

    const {
        showRegisterArea,
        hideRegisterArea,
        isRegisterMode,
        isFocusRegisterInput,
        focusRegisterInput,
        getInputNounValue,
        getInputVerbValue,
        exitRegisterArea,
    } = (() => {
        const registerArea = document.getElementById("register");
        const inputNoun = document.getElementById("inputNoun");
        const inputVerb = document.getElementById("inputVerb");
        const hideIsInput = document.querySelectorAll(".hide-is-input");

        const inputs = [inputNoun, inputVerb];

        let isShow = false;
        let isFocus = false;

        inputs.forEach((input) => {
            input.addEventListener("focus", () => {
                isFocus = true;
                hideIsInput.forEach((el) => {
                    el.style.display = "none";
                });
            });

            input.addEventListener("blur", (e) => {
                if (inputs.includes(e.relatedTarget)) return;
                isFocus = false;
                hideIsInput.forEach((el) => {
                    el.style.display = "";
                });
            });
        });

        return {
            showRegisterArea: () => {
                registerArea.style.display = "flex";
                isShow = true;
            },
            hideRegisterArea: () => {
                registerArea.style.display = "none";
                isShow = false;
            },
            isRegisterMode: () => {
                return isShow;
            },
            isFocusRegisterInput: () => {
                return isFocus;
            },
            focusRegisterInput: () => {
                if (!isShow) return;
                const currentIndex = inputs.indexOf(document.activeElement);
                if (currentIndex === inputs.length - 1) {
                    document.activeElement.blur();
                    return;
                }
                const nextIndex = currentIndex + 1;
                inputs[nextIndex].focus();
            },
            getInputNounValue: () => {
                return escapeHTML(inputNoun.value.trim());
            },
            getInputVerbValue: () => {
                return escapeHTML(inputVerb.value.trim());
            },
            exitRegisterArea: () => {
                inputNoun.value = "";
                inputVerb.value = "";
                hideRegisterArea();
            },
        };
    })();

    const {
        showSearchArea,
        hideSearchArea,
        isSearchMode,
        isFocusSearchInput,
        focusSearchInput,
        getInputSearchValue,
        exitSearchArea,
    } = (() => {
        const searchArea = document.getElementById("search");
        const inputSearch = document.getElementById("inputSearch");
        const hideIsInput = document.querySelectorAll(".hide-is-input");
        const searchModeName = document.getElementById("searchModeName");

        let isShow = false;
        let isFocus = false;
        let searchMode = null;

        inputSearch.addEventListener("focus", () => {
            isFocus = true;
            hideIsInput.forEach((el) => {
                el.style.display = "none";
            });
        });

        inputSearch.addEventListener("blur", () => {
            isFocus = false;
            hideIsInput.forEach((el) => {
                el.style.display = "";
            });
        });

        return {
            showSearchArea: (mode) => {
                searchMode = mode;
                searchModeName.textContent = STATE[mode].name;
                isShow = true;
                searchArea.style.display = "flex";
            },
            hideSearchArea: () => {
                searchArea.style.display = "none";
                searchMode = null;
                searchModeName.textContent = "";
                isShow = false;
            },
            isSearchMode: () => {
                return isShow;
            },
            isFocusSearchInput: () => {
                return isFocus;
            },
            focusSearchInput: () => {
                if (!isShow) return;
                if (document.activeElement === inputSearch) {
                    inputSearch.blur();
                } else {
                    inputSearch.focus();
                }
            },
            getInputSearchValue: () => {
                return escapeHTML(inputSearch.value.trim());
            },
            exitSearchArea: () => {
                inputSearch.value = "";
                hideSearchArea();
            },
        };
    })();

    const applyResult = (mode, { items, page = 0, hasNext = false, lastAction = null }) => {
        const state = STATE[mode];
        state.items = items;
        state.index = 0;
        state.page = page;
        state.hasNext = hasNext;
        state.lastAction = lastAction;
        state.deleteds = new Set();
        renderList(mode);
        console.log("「" + state.name + "」を更新しました");
    };

    const renderList = (mode) => {
        const state = STATE[mode];
        const cache = LIST_ELEMENTS[mode];

        const label = state.hasNext ? "＋" : "";
        if (cache.span && cache.label !== label) {
            cache.span.textContent = label;
            cache.label = label;
        }

        const lists = cache.lists;

        for (let i = 0; i < LIST_LENGTH_LIMIT; i++) {
            const li = lists[i];
            const row = state.items[i];
            if (row) {
                li.textContent = row[0] + (row[1] ? " を " + row[1] : "");
                li.style.display = "block";
                li.classList.toggle("deleted", state.deleteds.has(i));
                li.classList.toggle("selected", i === state.index);
            } else {
                li.style.display = "none";
            }
        }
    };

    const goToPage = (mode, dir) => {
        const state = STATE[mode];
        if (!state.lastAction) return;
        const nextPage = state.page + dir;
        if (nextPage < 0) return;
        if (dir > 0 && !state.hasNext) return;
        const { action, payload } = state.lastAction;
        postMessageWithFlag({ action, payload: { ...payload, page: nextPage } });
    };

    const updateDeletedItem = ({ type, data }) => {
        const state = STATE[type];
        const index = state.items.findIndex((row) => row[0] === data[0] && row[1] === data[1]);
        if (index !== -1) {
            state.deleteds.add(index);
            renderList(type);
        }
        const word = data[0] + (data[1] ? " を " + data[1] : "");
        setStatus(`「${word}」を${state.name}から削除しました`);
        console.log(`「${word}」を${state.name}から削除しました`);
    };

    const updateSavedItem = ({ type, data }) => {
        const state = STATE[type];
        const index = state.items.findIndex((row) => row[0] === data[0] && row[1] === data[1]);
        if (index !== -1) {
            // 現在ページに表示中（削除の取り消し）→ 取り消し線を外すだけ
            state.deleteds.delete(index);
            renderList(type);
        } else {
            // 新規保存 → 保存先モードのページ0を取り直して最新を先頭に出す
            postMessageWithFlag({ action: "getItems", payload: { type, page: 0 } });
        }
        const word = data[0] + (data[1] ? " を " + data[1] : "");
        setStatus(`「${word}」を${state.name}に保存しました`);
        console.log(`「${word}」を${state.name}に保存しました`);
    };

    let isWorking = true;

    const postMessageWithFlag = ({ action, payload }) => {
        if (isWorking) {
            console.log(`まだ通信中のためメッセージを送ることはできません`);
            return;
        }
        isWorking = true;
        payload = payload || {};
        payload.limit = payload.limit || LIST_LENGTH_LIMIT;
        worker.postMessage({ action, payload });
    };

    let isAppReady = false;

    worker.onmessage = (e) => {
        isWorking = false;
        const { type, result } = e.data;

        switch (type) {
            case "error":
                if (result.errorType === "INIT_FAILED")
                    loadingEl.textContent = "アプリケーションの初期化に失敗しました";
                break;
            case "wasm_progress":
                loadingEl.textContent = "データベースの準備をしています...";
                break;
            case "download_progress":
                loadingEl.textContent = `データベースをダウンロードしています...（${result}%）`;
                break;
            case "ready":
                console.log("OPFSからデータを読み込んでいます...");
                postMessageWithFlag({ action: "init" });
                break;
            case "init_result": {
                const { sentencesExample, sentencesFavorite, nounsFavorite, verbsFavorite, generateSentences } = result;
                applyResult(MODE.SENTENCE_EXAMPLE, { items: sentencesExample.items });
                applyResult(MODE.NOUN_FAVORITE, {
                    items: nounsFavorite.items,
                    page: nounsFavorite.page,
                    hasNext: nounsFavorite.hasNext,
                    lastAction: { action: "getItems", payload: { type: MODE.NOUN_FAVORITE } },
                });
                applyResult(MODE.VERB_FAVORITE, {
                    items: verbsFavorite.items,
                    page: verbsFavorite.page,
                    hasNext: verbsFavorite.hasNext,
                    lastAction: { action: "getItems", payload: { type: MODE.VERB_FAVORITE } },
                });
                applyResult(MODE.SENTENCE_FAVORITE, {
                    items: sentencesFavorite.items,
                    page: sentencesFavorite.page,
                    hasNext: sentencesFavorite.hasNext,
                    lastAction: { action: "getItems", payload: { type: MODE.SENTENCE_FAVORITE } },
                });
                applyResult(MODE.GENERATE, { items: generateSentences.items });
                setMode(MODE.SENTENCE_EXAMPLE);
                loadingEl.remove();
                document.getElementById("app").style.visibility = "visible";
                console.log("OPFSからデータを読み込みました");
                setStatus("ようこそ「を研究所」へ");

                isAppReady = true;
                break;
            }
            case "getItems_result": {
                const paginated = result.page !== undefined;
                applyResult(result.type, {
                    items: result.items,
                    page: result.page || 0,
                    hasNext: result.hasNext || false,
                    lastAction: paginated ? { action: "getItems", payload: { type: result.type } } : null,
                });
                break;
            }
            case "deleteWord_result":
                updateDeletedItem({ type: result.type, data: [result.word] });
                break;
            case "saveWord_result":
                updateSavedItem({ type: result.type, data: [result.word] });
                break;
            case "deleteSentence_result":
                updateDeletedItem({ type: result.type, data: [result.noun, result.verb] });
                break;
            case "saveSentence_result":
                updateSavedItem({ type: result.type, data: [result.noun, result.verb] });
                break;
            case "generateSentencesWithRandomByFavorites_result":
                setStatus("保存した名詞と動詞をランダムに組み合わせて作文しました");
                applyResult(MODE.GENERATE, { items: result.items });
                break;
            case "generateSentencesWithRandomByExamples_result":
                setStatus("例文の名詞と動詞をランダムに組み合わせて作文しました");
                applyResult(MODE.GENERATE, { items: result.items });
                break;
            case "generateSentencesWithWordByFavorites_result":
                setStatus(
                    `${STATE[result.fixedTable].name}の「${result.fixedWord}」と${STATE[result.targetTable].name}全部で作文しました`,
                );
                applyResult(MODE.GENERATE, {
                    items: result.items,
                    page: result.page || 0,
                    hasNext: result.hasNext || false,
                    lastAction: {
                        action: "generateSentencesWithWordByFavorites",
                        payload: {
                            fixedTable: result.fixedTable.replace("_favorite", ""),
                            targetTable: result.targetTable.replace("_favorite", ""),
                            fixedWord: result.fixedWord,
                        },
                    },
                });
                break;
            case "searchSentences_result":
                setStatus(`「${result.word}」を含む例文を検索しました`);
                applyResult(MODE.SENTENCE_EXAMPLE, {
                    items: result.items,
                    page: result.page || 0,
                    hasNext: result.hasNext || false,
                    lastAction: { action: "searchSentences", payload: { word: result.word } },
                });
                break;
            case "searchWords_result":
                setStatus(`「${result.word}」を含む${STATE[result.type].name}を検索しました`);
                applyResult(result.type, {
                    items: result.items,
                    page: result.page || 0,
                    hasNext: result.hasNext || false,
                    lastAction: {
                        action: "searchWords",
                        payload: { type: result.type.replace("_favorite", ""), word: result.word },
                    },
                });
                break;
        }
    };

    const KeydownCommands = {
        REGISTER: {
            enter: ({ e }) => {
                if (e.isComposing) return;
                e.preventDefault();
                focusRegisterInput();
            },
        },
        SEARCH: {
            enter: ({ e }) => {
                if (e.isComposing) return;
                e.preventDefault();
                focusSearchInput();
            },
        },
        MAIN: {
            w: ({ e, cm }) => {
                const state = STATE[cm];
                if (state.items.length === 0) return;
                const targetIndex = Math.max(0, state.index - 1);
                if (targetIndex !== state.index) {
                    state.index = targetIndex;
                    renderList(cm);
                }
            },
            s: ({ e, cm }) => {
                const state = STATE[cm];
                if (state.items.length === 0) return;
                const targetIndex = Math.min(state.index + 1, state.items.length - 1);
                if (targetIndex !== state.index) {
                    state.index = targetIndex;
                    renderList(cm);
                }
            },
            a: () => prevMode(),
            d: () => nextMode(),
            arrowright: ({ e, cm }) => {
                e.preventDefault();
                goToPage(cm, 1);
            },
            arrowleft: ({ e, cm }) => {
                e.preventDefault();
                goToPage(cm, -1);
            },
        },
    };

    window.addEventListener("keydown", (e) => {
        if (!isAppReady || isWorking) return;

        const cm = getMode();
        const ck = isRegisterMode() ? "REGISTER" : isSearchMode() ? "SEARCH" : "MAIN";
        const commands = KeydownCommands[ck];
        const key = e.key.toLowerCase();
        const command = commands[key];

        if (command) command({ e, cm });
    });

    const SAVE_WORD_LIMIT = 1000;

    const KeyupCommands = {
        [MODE.NOUN_FAVORITE]: {
            r: ({ e }) => {
                e.preventDefault();
                showRegisterArea();
            },
            " ": () => postMessageWithFlag({ action: "getItems", payload: { type: MODE.NOUN_FAVORITE } }),
            q: () => showSearchArea(MODE.NOUN_FAVORITE),
            f: ({ item }) => {
                if (!item) return;
                const isDeleted = STATE[MODE.NOUN_FAVORITE].deleteds.has(STATE[MODE.NOUN_FAVORITE].index);
                postMessageWithFlag({
                    action: isDeleted ? "saveWord" : "deleteWord",
                    payload: { type: "noun", word: item[0] },
                });
            },
        },
        [MODE.VERB_FAVORITE]: {
            r: ({ e }) => {
                e.preventDefault();
                showRegisterArea();
            },
            " ": () => postMessageWithFlag({ action: "getItems", payload: { type: MODE.VERB_FAVORITE } }),
            q: () => showSearchArea(MODE.VERB_FAVORITE),
            f: ({ e, item }) => {
                if (!item) return;
                const isDeleted = STATE[MODE.VERB_FAVORITE].deleteds.has(STATE[MODE.VERB_FAVORITE].index);
                postMessageWithFlag({
                    action: isDeleted ? "saveWord" : "deleteWord",
                    payload: { type: "verb", word: item[0] },
                });
            },
        },
        [MODE.SENTENCE_FAVORITE]: {
            r: ({ e }) => {
                e.preventDefault();
                showRegisterArea();
            },
            " ": () => postMessageWithFlag({ action: "getItems", payload: { type: MODE.SENTENCE_FAVORITE } }),
            f: ({ item }) => {
                if (!item) return;
                const isDeleted = STATE[MODE.SENTENCE_FAVORITE].deleteds.has(STATE[MODE.SENTENCE_FAVORITE].index);
                postMessageWithFlag({
                    action: isDeleted ? "saveSentence" : "deleteSentence",
                    payload: { noun: item[0], verb: item[1] },
                });
            },
        },
        [MODE.SENTENCE_EXAMPLE]: {
            r: ({ e }) => {
                e.preventDefault();
                showRegisterArea();
            },
            " ": () => postMessageWithFlag({ action: "getItems", payload: { type: MODE.SENTENCE_EXAMPLE } }),
            q: () => showSearchArea(MODE.SENTENCE_EXAMPLE),
            f: ({ e, item }) => {
                if (!item) return;
                if (STATE[MODE.NOUN_FAVORITE].items.length >= SAVE_WORD_LIMIT) {
                    setStatus(`単語は　${SAVE_WORD_LIMIT}　以上保存できません`, "error");
                    return;
                }
                postMessageWithFlag({
                    action: "saveWord",
                    payload: { type: "noun", word: item[0] },
                });
            },
            g: ({ item }) => {
                if (!item) return;
                if (STATE[MODE.VERB_FAVORITE].items.length >= SAVE_WORD_LIMIT) {
                    setStatus(`単語は　${SAVE_WORD_LIMIT}　以上保存できません`, "error");
                    return;
                }
                postMessageWithFlag({
                    action: "saveWord",
                    payload: { type: "verb", word: item[1] },
                });
            },
        },
        [MODE.GENERATE]: {
            r: ({ e }) => {
                e.preventDefault();
                showRegisterArea();
            },
            f: ({ item }) => {
                if (!item) return;
                postMessageWithFlag({
                    action: "saveSentence",
                    payload: { noun: item[0], verb: item[1] },
                });
            },
            z: () => postMessageWithFlag({ action: "generateSentencesWithRandomByExamples" }),
            x: () => {
                const nounFavoriteItems = STATE[MODE.NOUN_FAVORITE].items;
                const verbFavoriteItems = STATE[MODE.VERB_FAVORITE].items;
                if (nounFavoriteItems.length <= 0 || verbFavoriteItems.length <= 0) return;
                postMessageWithFlag({ action: "generateSentencesWithRandomByFavorites" });
            },
            c: () => {
                const { items, index } = STATE[MODE.NOUN_FAVORITE];
                if (items.length <= 0) return;
                postMessageWithFlag({
                    action: "generateSentencesWithWordByFavorites",
                    payload: { fixedTable: "noun", fixedWord: items[index][0], targetTable: "verb" },
                });
            },
            v: () => {
                const { items, index } = STATE[MODE.VERB_FAVORITE];
                if (items.length <= 0) return;
                postMessageWithFlag({
                    action: "generateSentencesWithWordByFavorites",
                    payload: { fixedTable: "verb", fixedWord: items[index][0], targetTable: "noun" },
                });
            },
        },
        REGISTER: {
            escape: ({ e }) => {
                e.preventDefault();
                exitRegisterArea();
            },
            f: ({ e }) => {
                if (isFocusRegisterInput()) return;
                const noun = getInputNounValue();
                const verb = getInputVerbValue();
                if (noun === "" && verb === "") return;
                e.preventDefault();
                if (noun && verb) postMessageWithFlag({ action: "saveSentence", payload: { noun, verb } });
                else if (!noun && verb)
                    postMessageWithFlag({ action: "saveWord", payload: { type: "verb", word: verb } });
                else if (noun && !verb)
                    postMessageWithFlag({ action: "saveWord", payload: { type: "noun", word: noun } });
                exitRegisterArea();
            },
        },
        SEARCH: {
            escape: ({ e }) => {
                e.preventDefault();
                exitSearchArea();
            },
            f: ({ e, cm }) => {
                if (isFocusSearchInput()) return;
                const word = getInputSearchValue();
                if (word === "") return;
                e.preventDefault();
                if (cm === MODE.NOUN_FAVORITE) {
                    postMessageWithFlag({ action: "searchWords", payload: { type: "noun", word } });
                } else if (cm === MODE.VERB_FAVORITE) {
                    postMessageWithFlag({ action: "searchWords", payload: { type: "verb", word } });
                } else if (cm === MODE.SENTENCE_EXAMPLE) {
                    postMessageWithFlag({ action: "searchSentences", payload: { word } });
                }
                exitSearchArea();
            },
        },
    };

    window.addEventListener("keyup", (e) => {
        if (!isAppReady || isWorking) return;

        const cm = getMode();
        const ck = isRegisterMode() ? "REGISTER" : isSearchMode() ? "SEARCH" : cm;
        const commands = KeyupCommands[ck];
        const key = e.key.toLowerCase();
        const command = commands[key];

        if (command) {
            e.preventDefault();
            const { items, index } = STATE[cm] || {};
            const item = items ? items[index] : null;
            command({ e, cm, item });
        }
    });
})();
