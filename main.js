(() => {
    const loadingEl = document.getElementById("loading");

    if (/Mobi|Android|iPhone/i.test(navigator.userAgent)) {
        loadingEl.textContent = "※このページはPC専用です";
        return;
    }

    if (!navigator.storage || !navigator.storage.getDirectory) {
        loadingEl.textContent = "※このブラウザはOPFSをサポートしていません。最新のブラウザを使用してください。";
        return;
    }

    const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });

    const MODE = {
        SENTENCE_EXAMPLE: "sentence_example",
        NOUN_FAVORITE: "noun_favorite",
        VERB_FAVORITE: "verb_favorite",
        GENERATE: "generate",
        SENTENCE_FAVORITE: "sentence_favorite",
    };

    const LIST_LENGTH_LIMIT = (() => {
        const mainEl = document.querySelector("main");
        const dummyLi = document.getElementById("dummyLi");
        const listHeight = mainEl.clientHeight;
        const itemHeight = dummyLi.offsetHeight || 24;
        const listLengthLimit = Math.floor(listHeight / itemHeight);
        const remainder = listHeight % itemHeight;
        document.querySelector("header").style.height = `calc(70px + ${remainder}px)`;
        mainEl.style.height = `${listLengthLimit * itemHeight}px`;
        dummyLi.remove();
        console.log(`表示件数を ${listLengthLimit} に設定しました`);
        return listLengthLimit;
    })();

    Object.values(MODE).forEach((mode) => {
        const list = document.getElementById(mode + "-list");
        for (let i = 0; i < LIST_LENGTH_LIMIT; i++) {
            const li = document.createElement("li");
            li.style.display = "none";
            list.appendChild(li);
        }
    });

    const STATE = {
        [MODE.SENTENCE_EXAMPLE]: { name: "例文", items: [], index: 0, offset: 0 },
        [MODE.NOUN_FAVORITE]: { name: "名詞", items: [], index: 0, offset: 0 },
        [MODE.VERB_FAVORITE]: { name: "動詞", items: [], index: 0, offset: 0 },
        [MODE.SENTENCE_FAVORITE]: { name: "名文", items: [], index: 0, offset: 0 },
        [MODE.GENERATE]: { name: "作文", items: [], index: 0, offset: 0 },
    };

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
                document.querySelectorAll('[id$="-title"]').forEach((list) => {
                    if (list.id.includes(mode)) {
                        list.classList.add("selected");
                    } else {
                        list.classList.remove("selected");
                    }
                });
                const dls = document.querySelectorAll("header dl");
                dls.forEach((dl, index) => {
                    if (index === dls.length - 1 || dl.id.includes(mode)) {
                        dl.style.display = "inline-block";
                    } else {
                        dl.style.display = "none";
                    }
                });
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
        isShowRegisterArea,
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
            isShowRegisterArea: () => {
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
        isShowSearchArea,
        isFocusSearchInput,
        focusSearchInput,
        getInputSearchValue,
        exitSearchArea,
    } = (() => {
        const searchArea = document.getElementById("search");
        const inputSearch = document.getElementById("inputSearch");
        const hideIsInput = document.querySelectorAll(".hide-is-input");

        let isShow = false;
        let isFocus = false;

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
            showSearchArea: () => {
                searchArea.style.display = "flex";
                isShow = true;
            },
            hideSearchArea: () => {
                searchArea.style.display = "none";
                isShow = false;
            },
            isShowSearchArea: () => {
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

    const renderList = (mode) => {
        const state = STATE[mode];

        if (state.index >= state.offset + LIST_LENGTH_LIMIT) {
            state.offset = state.index - LIST_LENGTH_LIMIT + 1;
        } else if (state.index < state.offset) {
            state.offset = state.index;
        }

        const ul = document.getElementById(mode + "-list");
        const lists = ul.getElementsByTagName("li");

        const displayCount = Math.min(state.items.length - state.offset, LIST_LENGTH_LIMIT);

        for (let i = 0; i < LIST_LENGTH_LIMIT; i++) {
            const li = lists[i];
            if (i < displayCount) {
                const itemIndex = state.offset + i;
                const item = state.items[itemIndex];
                li.textContent = item.text;
                li.style.display = "block";
                if (itemIndex === state.index) {
                    li.classList.add("selected");
                } else {
                    li.classList.remove("selected");
                }
                if (item.isDelete) {
                    li.classList.add("deleted");
                } else {
                    li.classList.remove("deleted");
                }
            } else {
                li.style.display = "none";
            }
        }
    };

    const updateItems = (mode, items) => {
        const formatItems = items.map((row) => {
            const text = row[0] + (row[1] ? " を " + row[1] : "");
            return { text: text, isDelete: false, data: row };
        });
        STATE[mode].items = formatItems;
        STATE[mode].index = 0;
        STATE[mode].offset = 0;
        renderList(mode);
        console.log("「" + STATE[mode].name + "」を更新しました");
    };

    const updateDeletedItem = ({ type, data }) => {
        const state = STATE[type];
        const index = state.items.findIndex((item) => item.data[0] === data[0] && item.data[1] === data[1]);
        if (index !== -1) {
            state.items[index].isDelete = true;
            renderList(type);
        }
        const word = data[0] + (data[1] ? " を " + data[1] : "");
        console.log("「" + word + "」を削除しました");
    };

    const updateSavedItem = ({ type, data }) => {
        const state = STATE[type];
        const index = state.items.findIndex((item) => item.data[0] === data[0] && item.data[1] === data[1]);
        if (index !== -1) {
            state.items[index].isDelete = false;
        } else {
            const text = data[0] + (data[1] ? " を " + data[1] : "");
            state.items.unshift({ text, isDelete: false, data });
            state.index = 0;
        }
        renderList(type);
        const word = data[0] + (data[1] ? " を " + data[1] : "");
        console.log("「" + word + "」を保存しました");
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
                console.error("WORKERエラー：", result.errorMessage);
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
                updateItems(MODE.SENTENCE_EXAMPLE, sentencesExample.items);
                updateItems(MODE.NOUN_FAVORITE, nounsFavorite.items);
                updateItems(MODE.VERB_FAVORITE, verbsFavorite.items);
                updateItems(MODE.SENTENCE_FAVORITE, sentencesFavorite.items);
                updateItems(MODE.GENERATE, generateSentences.items);
                setMode(MODE.SENTENCE_EXAMPLE);
                loadingEl.remove();
                document.getElementById("app").style.visibility = "visible";
                console.log("OPFSからデータを読み込みました");
                isAppReady = true;
                break;
            }
            case "getItems_result":
                updateItems(result.type, result.items);
                break;
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
            case "generateSentences_result":
            case "generateSentencesWithRandom_result":
                updateItems(MODE.GENERATE, result.items);
                break;
            case "generateSentencesWithWord_result":
                updateItems(MODE.GENERATE, result.items);
                break;
            case "searchSentences_result":
                updateItems(MODE.SENTENCE_EXAMPLE, result.items);
                break;
        }
    };

    const KeydownCommands = {
        w: (cm) => {
            const state = STATE[cm];
            if (state.items.length === 0) return;
            const targetIndex = Math.max(0, state.index - 1);
            if (targetIndex !== state.index) {
                state.index = targetIndex;
                renderList(cm);
            }
        },
        s: (cm) => {
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
    };

    window.addEventListener("keydown", (e) => {
        if (!isAppReady || isWorking) return;

        if (isShowRegisterArea()) {
            if (e.key === "Enter") {
                if (e.isComposing) return;
                e.preventDefault();
                focusRegisterInput();
            }
            return;
        }

        if (isShowSearchArea()) {
            if (e.key === "Enter") {
                if (e.isComposing) return;
                e.preventDefault();
                focusSearchInput();
            }
            return;
        }

        const cm = getMode();
        const command = KeydownCommands[e.key.toLowerCase()];
        if (command) {
            e.preventDefault();
            command(cm);
        }
    });

    const KeyupCommands = {
        [MODE.NOUN_FAVORITE]: {
            " ": () => postMessageWithFlag({ action: "getItems", payload: { type: MODE.NOUN_FAVORITE } }),
            f: (e, item) =>
                postMessageWithFlag({
                    action: item.isDelete ? "saveWord" : "deleteWord",
                    payload: { type: "noun", word: item.text },
                }),
        },
        [MODE.VERB_FAVORITE]: {
            " ": () => postMessageWithFlag({ action: "getItems", payload: { type: MODE.VERB_FAVORITE } }),
            f: (e, item) =>
                postMessageWithFlag({
                    action: item.isDelete ? "saveWord" : "deleteWord",
                    payload: { type: "verb", word: item.text },
                }),
        },
        [MODE.SENTENCE_FAVORITE]: {
            " ": () => postMessageWithFlag({ action: "getItems", payload: { type: MODE.SENTENCE_FAVORITE } }),
            f: (e, item) =>
                postMessageWithFlag({
                    action: item.isDelete ? "saveSentence" : "deleteSentence",
                    payload: { noun: item.data[0], verb: item.data[1] },
                }),
        },
        [MODE.SENTENCE_EXAMPLE]: {
            " ": () => postMessageWithFlag({ action: "getItems", payload: { type: MODE.SENTENCE_EXAMPLE } }),
            q: (e) => showSearchArea(),
            f: (e, item) => {
                if (!item) return;
                postMessageWithFlag({
                    action: "saveWord",
                    payload: { type: e.shiftKey ? "verb" : "noun", word: e.shiftKey ? item.data[1] : item.data[0] },
                });
            },
        },
        [MODE.GENERATE]: {
            f: (e, item) =>
                postMessageWithFlag({
                    action: "saveSentence",
                    payload: { noun: item.data[0], verb: item.data[1] },
                }),
            z: (e) => postMessageWithFlag({ action: "generateSentencesWithRandom" }),
            x: (e) => {
                const nounFavoriteItems = STATE[MODE.NOUN_FAVORITE].items;
                const verbFavoriteItems = STATE[MODE.VERB_FAVORITE].items;
                if (nounFavoriteItems.length <= 0 || verbFavoriteItems.length <= 0) return;
                postMessageWithFlag({ action: "generateSentences" });
            },
            c: (e) => {
                const { items, index } = STATE[MODE.NOUN_FAVORITE];
                if (items.length <= 0) return;
                postMessageWithFlag({
                    action: "generateSentencesWithWord",
                    payload: { fixedTable: "noun", fixedWord: items[index].text, targetTable: "verb" },
                });
            },
            v: (e) => {
                const { items, index } = STATE[MODE.VERB_FAVORITE];
                if (items.length <= 0) return;
                postMessageWithFlag({
                    action: "generateSentencesWithWord",
                    payload: { fixedTable: "verb", fixedWord: items[index].text, targetTable: "noun" },
                });
            },
        },
    };

    window.addEventListener("keyup", (e) => {
        if (!isAppReady || isWorking) return;

        if (isShowRegisterArea()) {
            if (isFocusRegisterInput()) return;
            if (e.key === "Escape") {
                e.preventDefault();
                hideRegisterArea();
            } else if (e.key === "f") {
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
            }
            return;
        }

        if (isShowSearchArea()) {
            if (isFocusSearchInput()) return;
            if (e.key === "Escape") {
                e.preventDefault();
                hideSearchArea();
            } else if (e.key === "f") {
                const word = getInputSearchValue();
                if (word === "") return;
                e.preventDefault();
                postMessageWithFlag({ action: "searchSentences", payload: { word } });
                exitSearchArea();
            }
            return;
        }

        if (e.key === "r") {
            e.preventDefault();
            showRegisterArea();
            return;
        }

        let normalizedKey = e.key;
        if (normalizedKey.toLowerCase() === "f") normalizedKey = "f";

        const cm = getMode();
        const command = KeyupCommands[cm] && KeyupCommands[cm][normalizedKey];
        if (command) {
            e.preventDefault();
            const { items, index } = STATE[cm];
            command(e, items[index]);
        }
    });
})();
