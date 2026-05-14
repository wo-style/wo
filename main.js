(() => {
    const loadingEl = document.getElementById("loading");

    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    if (isMobile) {
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
        const dummyUl = document.createElement("ul");
        const dummyLi = document.createElement("li");
        dummyLi.textContent = "太陽を張り込む";
        dummyUl.appendChild(dummyLi);
        mainEl.appendChild(dummyUl);
        const listHeight = mainEl.clientHeight;
        const itemHeight = dummyLi.offsetHeight || 24;
        const listLengthLimit = Math.floor(listHeight / itemHeight);
        const remainder = listHeight % itemHeight;
        document.querySelector("header").style.height = `calc(70px + ${remainder}px)`;
        mainEl.style.height = `${listLengthLimit * itemHeight}px`;
        mainEl.removeChild(dummyUl);
        console.log(`各モードの表示件数を ${listLengthLimit} に設定しました`);
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
        [MODE.SENTENCE_FAVORITE]: { name: "お気に入り", items: [], index: 0, offset: 0 },
        [MODE.GENERATE]: { name: "作文", items: [], index: 0, offset: 0 },
    };

    const {
        getMode,
        setMode,
        nextMode,
        prevMode,
        isSentenceExampleMode,
        isNounFavoriteMode,
        isVerbFavoriteMode,
        isSentenceFavoriteMode,
        isGenerateMode,
        isFavoriteMode,
        getTableFromMode,
    } = (() => {
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
            isSentenceExampleMode: (mode = currentMode) => {
                return mode === MODE.SENTENCE_EXAMPLE;
            },
            isNounFavoriteMode: (mode = currentMode) => {
                return mode === MODE.NOUN_FAVORITE;
            },
            isVerbFavoriteMode: (mode = currentMode) => {
                return mode === MODE.VERB_FAVORITE;
            },
            isSentenceFavoriteMode: (mode = currentMode) => {
                return mode === MODE.SENTENCE_FAVORITE;
            },
            isGenerateMode: (mode = currentMode) => {
                return mode === MODE.GENERATE;
            },
            isFavoriteMode: (mode = currentMode) => {
                return [MODE.NOUN_FAVORITE, MODE.VERB_FAVORITE, MODE.SENTENCE_FAVORITE].includes(mode);
            },
            getTableFromMode: (mode) => {
                if (mode === MODE.NOUN_FAVORITE) return "noun";
                if (mode === MODE.VERB_FAVORITE) return "verb";
                if (mode === MODE.SENTENCE_FAVORITE) return "sentence";
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
        const switchFocusCaption = document.getElementById("switchFocusCaption");

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
                    switchFocusCaption.textContent = "入力する";
                } else {
                    inputSearch.focus();
                    switchFocusCaption.textContent = "入力をやめる";
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
        const allItems = items.map((row) => {
            const text = row[0] + (row[1] ? " を " + row[1] : "");
            return { text: text, isDelete: false, data: row };
        });
        STATE[mode].items = allItems;
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
        if (type === "error") {
            console.error("WORKERエラー：", result.errorMessage);
            if (result.errorType === "INIT_FAILED") loadingEl.textContent = "アプリケーションの初期化に失敗しました";
            return;
        } else if (type === "wasm_progress") {
            loadingEl.textContent = "データベースの準備をしています...";
        } else if (type === "download_progress") {
            loadingEl.textContent = `データベースをダウンロードしています...（${result}%）`;
        } else if (type === "ready") {
            console.log("OPFSからデータを読み込んでいます...");
            postMessageWithFlag({ action: "init" });
        } else if (type === "init_result") {
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
        } else if (type === "getItems_result") {
            const { type, items } = result;
            updateItems(type, items);
        } else if (type === "deleteWord_result") {
            const { type, word } = result;
            updateDeletedItem({ type: type, data: [word] });
        } else if (type === "saveWord_result") {
            const { type, word } = result;
            updateSavedItem({ type: type, data: [word] });
        } else if (type === "deleteSentence_result") {
            const { type, noun, verb } = result;
            updateDeletedItem({ type: type, data: [noun, verb] });
        } else if (type === "saveSentence_result") {
            const { type, noun, verb } = result;
            updateSavedItem({ type: type, data: [noun, verb] });
        } else if (type === "generateSentences_result") {
            updateItems(MODE.GENERATE, result.items);
        } else if (type === "generateSentencesWithWord_result") {
            updateItems(MODE.GENERATE, result.items);
            if (result.items.length > 0) setMode(MODE.GENERATE);
        } else if (type === "generateSentencesWithRandom_result") {
            updateItems(MODE.GENERATE, result.items);
        } else if (type === "searchSentences_result") {
            updateItems(MODE.SENTENCE_EXAMPLE, result.items);
        }
    };

    window.addEventListener("keydown", (e) => {
        if (!isAppReady) return;
        if (isWorking) return;
        if (isShowRegisterArea()) {
            if (e.key === "Enter") {
                if (e.isComposing) return;
                e.preventDefault();
                focusRegisterInput();
            }
        } else if (isShowSearchArea()) {
            if (e.key === "Enter") {
                if (e.isComposing) return;
                e.preventDefault();
                focusSearchInput();
            }
        } else {
            const cm = getMode();
            if (e.key === "s" || e.key === "w") {
                e.preventDefault();
                const state = STATE[cm];
                const { items, index } = state;
                if (items.length === 0) return;
                let targetIndex = e.key === "s" ? index + 1 : index - 1;
                targetIndex = Math.max(0, Math.min(targetIndex, items.length - 1));
                if (targetIndex !== index) {
                    state.index = targetIndex;
                    renderList(cm);
                }
            } else if (e.key === "d") {
                e.preventDefault();
                nextMode();
            } else if (e.key === "a") {
                e.preventDefault();
                prevMode();
            }
        }
    });

    window.addEventListener("keyup", (e) => {
        if (!isAppReady) return;
        if (isWorking) return;
        if (isShowRegisterArea()) {
            if (isFocusRegisterInput()) return;
            if (e.key === "r") {
                e.preventDefault();
                hideRegisterArea();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const noun = getInputNounValue();
                const verb = getInputVerbValue();
                if (noun && verb) {
                    postMessageWithFlag({ action: "saveSentence", payload: { noun, verb } });
                } else if (!noun && verb) {
                    postMessageWithFlag({ action: "saveWord", payload: { type: "verb", word: verb } });
                } else if (noun && !verb) {
                    postMessageWithFlag({ action: "saveWord", payload: { type: "noun", word: noun } });
                }
                exitRegisterArea();
            }
        } else if (isShowSearchArea()) {
            if (isFocusSearchInput()) return;
            if (e.key === "q") {
                e.preventDefault();
                hideSearchArea();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                const word = getInputSearchValue();
                postMessageWithFlag({ action: "searchSentences", payload: { word } });
                exitSearchArea();
            }
        } else {
            const cm = getMode();
            if (e.key === "r") {
                e.preventDefault();
                showRegisterArea();
            } else if (e.key === "q") {
                if (isSentenceExampleMode()) {
                    e.preventDefault();
                    showSearchArea();
                }
            } else {
                const { items, index } = STATE[cm];
                if (e.key === " ") {
                    e.preventDefault();
                    if (isFavoriteMode(cm)) {
                        postMessageWithFlag({ action: "getItems", payload: { type: cm } });
                    } else if (isSentenceExampleMode(cm)) {
                        postMessageWithFlag({ action: "getItems", payload: { type: cm } });
                    } else if (isGenerateMode(cm)) {
                        if (e.shiftKey) {
                            postMessageWithFlag({ action: "generateSentencesWithRandom" });
                        } else {
                            postMessageWithFlag({ action: "generateSentences" });
                        }
                    }
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if (isNounFavoriteMode(cm) || isVerbFavoriteMode(cm)) {
                        if (items[index].isDelete) {
                            const type = getTableFromMode(cm);
                            const word = items[index].text;
                            postMessageWithFlag({ action: "saveWord", payload: { type, word } });
                        }
                    } else if (isGenerateMode(cm)) {
                        const row = items[index].data;
                        const noun = row[0];
                        const verb = row[1];
                        postMessageWithFlag({ action: "saveSentence", payload: { noun, verb } });
                    } else if (isSentenceFavoriteMode(cm)) {
                        if (items[index].isDelete) {
                            const row = items[index].data;
                            const noun = row[0];
                            const verb = row[1];
                            postMessageWithFlag({ action: "saveSentence", payload: { noun, verb } });
                        }
                    } else if (isSentenceExampleMode(cm)) {
                        if (e.shiftKey) {
                            e.preventDefault();
                            postMessageWithFlag({
                                action: "saveWord",
                                payload: { type: "verb", word: items[index].data[1] },
                            });
                        } else {
                            e.preventDefault();
                            postMessageWithFlag({
                                action: "saveWord",
                                payload: { type: "noun", word: items[index].data[0] },
                            });
                        }
                    }
                } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (isNounFavoriteMode(cm) || isVerbFavoriteMode(cm)) {
                        const type = getTableFromMode(cm);
                        const word = items[index].text;
                        postMessageWithFlag({ action: "deleteWord", payload: { type, word } });
                    } else if (isSentenceFavoriteMode(cm)) {
                        const row = items[index].data;
                        const noun = row[0];
                        const verb = row[1];
                        postMessageWithFlag({ action: "deleteSentence", payload: { noun, verb } });
                    }
                } else if (e.key === "Enter") {
                    if (isNounFavoriteMode(cm)) {
                        postMessageWithFlag({
                            action: "generateSentencesWithWord",
                            payload: {
                                fixedTable: "noun",
                                fixedWord: items[index].text,
                                targetTable: "verb",
                            },
                        });
                    } else if (isVerbFavoriteMode(cm)) {
                        postMessageWithFlag({
                            action: "generateSentencesWithWord",
                            payload: {
                                fixedTable: "verb",
                                fixedWord: items[index].text,
                                targetTable: "noun",
                            },
                        });
                    }
                }
            }
        }
    });
})();
