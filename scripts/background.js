console.time('START');

window.PW = {
    id: 0, //ID окна с вводом пароля
    login: false, //Введен ли пароль
    focus: false, //Активнен ли ввод пароля
    hash: null, //Текущий пароль в зашифрованном виде
    config: {
        minimize: true, //скрывать ли окна до ввода пароля
        securityMode: true, //закрытие браузра при потери фокуса пароля
        fullScreen: true, // открытие окно ввода пароля на весь экран
        quickClick: true, // горячие клавиши
        autoLock: false, // автоблокировка через {min}
        autoLockTime: 15, // автоблокировка через {min}
        attempts: 3, //Количество попыток для ввода пароля,
        attemptsActionClear: false, // Очистка истории браузера после {count} неудачных попыток
        attemptsActionNew: true, // Открытие новой страницы в икогнито после {count} неудачных попыток
        attemptsActionClose: true, // Закртие окон браузера при неверном пароле
        historyRecord: true //Запись истории действий
    },
    windowsHidden: {} //Состояние окон до ввода пароля
};

window.PW.setHistory = function (typeID, message, actions) {
    if (!window.PW.config.historyRecord) {
        return false;
    }

    const allHistories = JSON.parse(localStorage.getItem('histories') || '[]'), date = new Date();

    if (allHistories.length >= 20) {
        allHistories.pop();
    }

    allHistories.unshift({
        date: date.toDateString() + ', ' + date.toLocaleTimeString(),
        typeID: typeID,
        message: message,
        actions: actions
    });

    localStorage.setItem('histories', JSON.stringify(allHistories));

    return true;
};

/**
 * Подргружаем скрипт
 * @param name
 */
window.loadScript = (name) => {
    if (document.getElementById(`script-${name}`)) {
        console.log('script already', name);
        return false;
    }

    console.time('loadScript-' + name);

    const src = chrome.extension.getURL(`scripts/${name}.js`);

    const n = document.createElement('script');

    n.setAttribute('id', `script-${name}`);
    n.setAttribute('type', 'text/javascript');
    n.setAttribute('src', src);

    n.onload = function () {
        console.log(`${name} INIT`)
    };

    (document.head || document.documentElement).appendChild(n);

    console.timeEnd('loadScript-' + name);
};

/**
 * Скрываем активные окна
 * @returns {boolean}
 */
window.minimizationPage = function () {
    if (!window.PW.config.minimize) {
        return false;
    }

    console.log(window.PW, 'minimizationPage');

    chrome.windows.getAll({populate: false}, function (w) {
        for (let t in w) {
            if (!w[t].incognito && w[t].id !== window.PW.id) {
                if (!window.PW.windowsHidden[w[t].id]) {
                    window.PW.windowsHidden[w[t].id] = w[t].state;
                }

                chrome.windows.update(w[t].id, {state: 'minimized'});
            }
        }
    });
};

window.closedPage = function (all = false) {
    console.log(window.PW, all, 'closedPage');

    chrome.windows.getAll({populate: false}, function (w) {
        for (let t in w) {
            if (all || !w[t].incognito) {
                chrome.windows.remove(w[t].id);
            }
        }
    });
};

const initialize = function () {
    console.time('initialize');

    if (window.PW.login) {
        if (typeof ga === 'function') {
            ga('send', 'event', 'Login', 'Success', 'logged');
        }

        return;
    }

    window.PW.id = 0;
    window.PW.login = false;
    window.PW.focus = false;

    window.PW.windowsHidden = {};

    chrome.windows.getLastFocused(null, function (win) {
        const createData = {
            url: 'lockpw.html',
            type: 'popup',
            focused: true
        };

        if (!win) {
            chrome.runtime.lastError.message;

            win = {
                width: window.screen.width,
                height: window.screen.height
            }
        }

        if (window.PW.config.fullScreen) {
            if (chrome.runtime.lastError) {
                chrome.runtime.lastError.message;
            }

            createData.state = 'fullscreen'
        } else {
            createData.width = 344;
            createData.height = 100;

            createData.left = Math.round((win.width / 2) - (createData.width / 2));
            createData.top = Math.round((win.height / 2) - (createData.height / 2));
        }

        chrome.windows.create(createData, function (w) {
            window.PW.id = w.id;
            window.PW.focus = w.focused;


            console.timeEnd('initialize');
        });
    });

    window.minimizationPage();
};

chrome.windows.onFocusChanged.addListener(function (windowId) {
    if (!window.PW.id || window.PW.login || !window.PW.hash) {
        return;
    }

    if (windowId !== window.PW.id) {
        console.log(window.PW, windowId, 'windows.onFocusChanged');

        if (window.PW.id > 0) {
            chrome.windows.update(window.PW.id, {focused: true}, function (w) {
                if (!w) {
                    chrome.runtime.lastError.message;
                }
            });
        }

        if (window.PW.config.securityMode) {
            if (windowId === -1) {
                window.PW.id = 0;
                window.PW.login = false;

                window.closedPage(true);

                window.PW.setHistory(2, window.chrome.i18n.getMessage('historyETAuth'), window.chrome.i18n.getMessage('historyEAFocus'));
            } else {
                chrome.windows.get(window.PW.id, function (w) {
                    if (!w || !w.focused) {
                        chrome.runtime.lastError.message;

                        window.PW.id = 0;
                        window.PW.login = false;

                        window.closedPage(true);

                        window.PW.setHistory(2, window.chrome.i18n.getMessage('historyETAuth'), window.chrome.i18n.getMessage('historyEAFocus'));
                    }
                });
            }
        }
    }

    window.minimizationPage();
});

chrome.windows.onRemoved.addListener(function (windowId) {
    console.log('onRemoved', windowId, window.PW);

    if (windowId !== -1 && windowId !== window.PW.id) {
        window.PW.id = 0;

        chrome.windows.getAll(function (windows) {
            if (!windows.length) {
                window.PW.login = false;
            }
        });
    }
});

chrome.tabs.onActivated.addListener(function (tabInfo) {
    if (window.PW.hash && !window.PW.id && !window.PW.login) {
        console.log(window.PW, tabInfo, 'tabs.onActivated');

        // window.minimizationPage();

        chrome.windows.get(tabInfo.windowId, function (w) {
            if (!w) {
                chrome.runtime.lastError.message;
                return;
            }

            if (!w.incognito && w.id !== window.PW.id) {
                initialize();
            }
        });
    }
});

chrome.runtime.onMessage.addListener(function (e) {
    if (e.event === 'password') {
        if (typeof window.PW.check !== 'function' || typeof md5 !== 'function') {
            window.loadScript('md5');
            window.loadScript('checkPassword');

            const r = self.setInterval(() => {
                if (typeof window.PW.check === 'function' && typeof md5 === 'function') {
                    window.clearInterval(r);

                    window.PW.check(e.value);
                }
            }, 100);
        } else {
            window.PW.check(e.value);
        }
    }
});

chrome.contextMenus.removeAll(function () {
    chrome.commands.onCommand.removeListener();

    chrome.contextMenus.create({
        title: chrome.i18n.getMessage('contextMenuLock'),
        contexts: ['page'],
        onclick: function () {
            if (typeof ga === 'function') {
                ga('send', 'event', 'ContextMenu', 'Click', 'lockOn');
            }

            if (localStorage.hasOwnProperty('pw')) {
                PW.setHistory(1, chrome.i18n.getMessage('historyETBlock'), chrome.i18n.getMessage('history_a_contextMenu'));

                chrome.runtime.reload();
            } else {
                chrome.tabs.create({url: 'index.html#settings'});
            }
        }
    });
});

chrome.commands.onCommand.addListener(function (command) {
    if (!window.PW.config.quickClick) {
        return;
    }

    if (command === 'lockON') {
        if (typeof ga === 'function') {
            ga('send', 'event', 'Command', 'Ctrl+Shift+L', 'lockOn');
        }

        PW.setHistory(1, chrome.i18n.getMessage('historyETBlock'), chrome.i18n.getMessage('historyEAHotkeys'));

        chrome.runtime.reload();
    }
});

chrome.storage.onChanged.addListener(function (data) {
    if (!window.PW.config) {
        window.PW.config = {}
    }

    for (let i in data) {
        window.PW.config[i] = data[i].newValue;
    }
});

console.time('get config');

chrome.storage.local.get(function (data) {
    window.PW.hash = localStorage.getItem('pw');

    if (data) {
        console.log(data, 'config');

        if (chrome.app.getDetails().version !== localStorage.getItem('version')) {
            localStorage.setItem('version', chrome.app.getDetails().version);

            for (let i in data) {
                if (i === 'security_mode') {
                    window.PW.config.securityMode = data[i] === true || data[i] === "true";
                } else if (i === 'minimize') {
                    window.PW.config.minimize = data[i] === true || data[i] === "true";
                } else if (i === 'history_active') {
                    window.PW.config.historyRecord = data[i] === true || data[i] === "true";
                } else if (i === 'quick_click') {
                    window.PW.config.quickClick = data[i] === true || data[i] === "true";
                } else if (i === 'attempts_act_close') {
                    window.PW.config.attemptsActionClose = data[i] === true || data[i] === "true";
                } else if (i === 'attempts_act_clear') {
                    window.PW.config.attemptsActionClear = data[i] === true || data[i] === "true";
                } else if (i === 'attempts_act_new') {
                    window.PW.config.attemptsActionNew = data[i] === true || data[i] === "true";
                }
            }

            window.PW.config.autoLock = false;
            window.PW.config.autoLockTime = 0;

            chrome.storage.local.set(window.PW.config);
        } else {
            for (let i in data) {
                window.PW.config[i] = data[i];
            }
        }
    }

    console.timeEnd('get config');

    if (window.PW.hash && window.PW.hash.length > 10) {
        initialize();
    } else if (!data.installed) {
        window.PW.config.installed = true;

        chrome.storage.local.set(window.PW.config);

        chrome.tabs.create({url: 'app.html'});
    }
});

chrome.runtime.onInstalled.addListener(function (details) {
    setTimeout(function () {
        if (typeof ga === 'function') {
            ga('send', 'event', details.reason, chrome.app.getDetails().version);
        }
    }, 1500);
});

console.timeEnd('START');
