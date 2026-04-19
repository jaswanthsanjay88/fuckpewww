(function () {
    'use strict';

    const _0x0 = [
        'script',
        'inject.js',
        'onload',
        'remove',
        'head',
        'documentElement',
        'appendChild',
        'message',
        'source',
        'data',
        'type',
        'PDF_URL_FOUND',
        'url',
        'stealth-dl-btn',
        'button',
        'id',
        'title',
        'Download PDF',
        'style',
        'cssText',
        'body',
        'innerHTML',
        'display',
        'flex',
        'onclick',
        'DOWNLOAD',
        'borderColor',
        '#4ade80',
        '#ffffff',
        '#333333',
        '#000000',
        'transform',
        'scale(1.1)',
        'scale(1)',
        'onmouseover',
        'onmouseout',
        'runtime',
        'getURL',
        'addEventListener',
        'sendMessage',
        'createElement',
        'getElementById',
        'window'
    ];

    const _0x1 = (i) => _0x0[i];
    const _0x2 = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
    const _0x3 = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    const _0x4 =
        'position: fixed !important;' +
        'bottom: 30px !important;' +
        'right: 30px !important;' +
        'z-index: 2147483647 !important;' +
        'background-color: #000000 !important;' +
        'border: 2px solid #ffffff !important;' +
        'width: 60px !important;' +
        'height: 60px !important;' +
        'border-radius: 50% !important;' +
        'display: flex !important;' +
        'align-items: center !important;' +
        'justify-content: center !important;' +
        'cursor: pointer !important;' +
        'box-shadow: 0 4px 15px rgba(0,0,0,0.8) !important;' +
        'transition: all 0.2s ease-in-out !important;' +
        'padding: 0 !important;' +
        'margin: 0 !important;';
    const _0x7 = (() => {
        const a = new Uint32Array(4);
        crypto.getRandomValues(a);
        return Array.from(a).map((n) => n.toString(16)).join('-');
    })();

    const _0x5 = (u) => {
        let b = document[_0x1(41)](_0x1(13));

        if (!b) {
            b = document[_0x1(40)](_0x1(14));
            b[_0x1(15)] = _0x1(13);
            b[_0x1(16)] = _0x1(17);
            b[_0x1(18)][_0x1(19)] = _0x4;
            b[_0x1(34)] = () => {
                b[_0x1(18)].backgroundColor = _0x1(29);
                b[_0x1(18)][_0x1(31)] = _0x1(32);
            };
            b[_0x1(35)] = () => {
                b[_0x1(18)].backgroundColor = _0x1(30);
                b[_0x1(18)][_0x1(31)] = _0x1(33);
            };
            document[_0x1(20)][_0x1(6)](b);
        }

        b[_0x1(21)] = _0x2;
        b[_0x1(18)][_0x1(22)] = _0x1(23);
        b[_0x1(24)] = () => {
            chrome[_0x1(36)][_0x1(39)]({ type: _0x1(25), url: u }, () => {
                if (chrome.runtime.lastError) {
                    return;
                }
                b[_0x1(21)] = _0x3;
                b[_0x1(18)][_0x1(26)] = _0x1(27);
                setTimeout(() => {
                    b[_0x1(21)] = _0x2;
                    b[_0x1(18)][_0x1(26)] = _0x1(28);
                }, 2000);
            });
        };
    };

    const _0x6 = document[_0x1(40)](_0x1(0));
    _0x6.src = chrome[_0x1(36)][_0x1(37)](_0x1(1));
    _0x6.setAttribute('data-ext-token', _0x7);
    _0x6[_0x1(2)] = function () {
        this[_0x1(3)]();
    };
    (document[_0x1(4)] || document[_0x1(5)])[_0x1(6)](_0x6);

    window[_0x1(38)](_0x1(7), function (e) {
        if (e[_0x1(8)] !== window || !e[_0x1(9)]) {
            return;
        }
        if (
            e[_0x1(9)][_0x1(10)] === _0x1(11) &&
            e[_0x1(9)].k === _0x7 &&
            typeof e[_0x1(9)][_0x1(12)] === 'string'
        ) {
            try {
                const p = new URL(e[_0x1(9)][_0x1(12)]);
                if (p.hostname !== 'storage.googleapis.com') {
                    return;
                }
                _0x5(p.href);
            } catch (_0x8) {
                return;
            }
        }
    });
})();