export class StatCheckDialog extends Dialog {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["stat-check-dialog"],
            width: 600,
            resizable: true
        });
    }
    static getContent() {
        // 플레이어 캐릭터만 필터링
        const characters = game.actors.filter(a => a.hasPlayerOwner);
        
        const statTypes = {
            abilities: {
                label: "능력치",
                options: {
                    convalue: "체력",
                    reflecvalue: "반사",
                    pervalue: "지각",
                    intvalue: "이지",
                    willvalue: "의지",
                    luckvalue: "행운"
                }
            },
            combat: {
                label: "전투치",
                options: {
                    hit: "명중",
                    evasion: "회피",
                    shelling: "포격",
                    pro: "방벽",
                    init: "행동"
                }
            }
        };

        let content = `
            <style>
                .character-list {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 15px;
                    max-height: 300px;
                    overflow-y: auto;
                    padding: 15px;
                    background: #f0f0f0;
                    border-radius: 10px;
                    margin-bottom: 15px;
                }
                .character-option {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                .character-option input[type="checkbox"] {
                    display: none;
                }
                .character-option label {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: pointer;
                    padding: 10px;
                    border-radius: 10px;
                    background: white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    transition: all 0.3s ease;
                    width: 100%;
                    height: 100%;
                }
                .character-option label:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                }
                .character-option input[type="checkbox"]:checked + label {
                    background: #4a4a4a;
                    color: white;
                    box-shadow: 0 0 0 3px #007bff;
                }
                .character-option img {
                    width: 60px;
                    height: 60px;
                    object-fit: cover;
                    border-radius: 50%;
                    margin-bottom: 10px;
                    border: 3px solid #ddd;
                    transition: all 0.3s ease;
                }
                .character-option input[type="checkbox"]:checked + label img {
                    border-color: #007bff;
                }
                .character-option span {
                    font-weight: bold;
                    text-align: center;
                    word-break: break-word;
                    font-size: 12px;
                }
                .stat-select {
                background: white;
                padding: 15px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 15px;
                }
                .stat-select select {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    margin-top: 5px;
                    background: white;
                    height: auto;
                    min-height: 36px;
                    line-height: 1.5;
                    appearance: none;
                    -webkit-appearance: none;
                    background-image: url('data:image/svg+xml;charset=US-ASCII,<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 10L3 6H11L7 10Z" fill="%234a4a4a"/></svg>');
                    background-repeat: no-repeat;
                    background-position: right 8px center;
                    padding-right: 30px;
                }
                .stat-select optgroup {
                    font-weight: bold;
                    font-size: 14px;
                    padding: 5px 0;
                }
                .stat-select option {
                    padding: 8px;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .difficulty-input {
                    background: white;
                    padding: 15px;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .difficulty-input input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    margin-top: 5px;
                }
                .section-label {
                    font-weight: bold;
                    color: #4a4a4a;
                    margin-bottom: 8px;
                }
            </style>
            <form>
                <div class="section-label">캐릭터 선택</div>
                <div class="character-list">
                    ${characters.map(char => `
                        <div class="character-option">
                            <input type="checkbox" id="${char.id}" name="character" value="${char.id}">
                            <label for="${char.id}">
                                <img src="${char.img}" alt="${char.name}">
                                <span>${char.name}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>

                <div class="stat-select">
                    <div class="section-label">판정 유형</div>
                    <select name="statType">
                        ${Object.entries(statTypes).map(([group, {label, options}]) => `
                            <optgroup label="${label}">
                                ${Object.entries(options).map(([value, label]) => 
                                    `<option value="${value}">${label}</option>`
                                ).join('')}
                            </optgroup>
                        `).join('')}
                    </select>
                </div>

                <div class="difficulty-input">
                    <div class="section-label">난이도</div>
                    <input type="number" name="difficulty" value="0">
                </div>
            </form>`;

        return content;
    }

    constructor(callback) {
        super({
            title: "능력치/전투치 판정 요청",
            content: StatCheckDialog.getContent(),
            buttons: {
                roll: {
                    icon: '<i class="fas fa-dice"></i>',
                    label: "판정 요청",
                    callback: (html) => {
                        const characterIds = html.find('input[name="character"]:checked')
                            .map((i, el) => el.value)
                            .get();
                        if (characterIds.length === 0) {
                            ui.notifications.warn("캐릭터를 선택해주세요.");
                            return;
                        }
                        const statType = html.find('[name="statType"]').val();
                        const difficulty = Number(html.find('[name="difficulty"]').val());
                        callback(characterIds, statType, difficulty);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소"
                }
            },
            default: "roll",
            render: html => {
                const element = html[0];
                if (element) {
                    element.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                    element.style.borderRadius = '8px';
                    
                    const buttons = element.querySelectorAll('button');
                    buttons.forEach(button => {
                        button.style.padding = '8px 16px';
                        button.style.borderRadius = '4px';
                        button.style.border = '1px solid #ddd';
                        button.style.background = 'white';
                        button.style.color = '#4a4a4a';
                        button.style.cursor = 'pointer';
                        button.style.display = 'flex';
                        button.style.alignItems = 'center';
                        button.style.gap = '8px';
                        button.style.fontWeight = 'bold';
                        
                        button.addEventListener('mouseenter', () => {
                            button.style.background = '#f8f9fa';
                        });
                        
                        button.addEventListener('mouseleave', () => {
                            button.style.background = 'white';
                        });
                    });

                    const rollButton = element.querySelector('[data-button="roll"]');
                    if (rollButton) {
                        rollButton.style.background = '#4a4a4a';
                        rollButton.style.color = 'white';
                        rollButton.style.border = 'none';
                        
                        rollButton.addEventListener('mouseenter', () => {
                            rollButton.style.background = '#3d3d3d';
                        });
                        
                        rollButton.addEventListener('mouseleave', () => {
                            rollButton.style.background = '#4a4a4a';
                        });
                    }
                }
            }
        });
    }

    static async createAndShow() {
        return new Promise((resolve) => {
            new StatCheckDialog((characterId, statType, difficulty) => {
                resolve({ characterId, statType, difficulty });
            }).render(true);
        });
    }
}

export class StatCheck {
    static initialize(socketlib) {
        if (!socketlib) {
            console.error('[StatCheck] No socketlib provided');
            return false;
        }

        try {
            this.socket = socketlib;
            this.socket.register('updateChatMessageAsGM', this._updateChatMessageAsGM.bind(this));
            console.log('[StatCheck] Successfully initialized');
            return true;
        } catch (error) {
            console.error('[StatCheck] Error during initialization:', error);
            return false;
        }
    }

    static async _updateChatMessageAsGM(messageId, updateData) {
        if (!game.user.isGM) return;
        const message = game.messages.get(messageId);
        if (message) {
            await message.update(updateData);
        }
    }

    static async requestCheck() {
        if (!game.user.isGM) return;

        const gmUser = game.users.find(u => u.isGM);
        const gmAvatar = gmUser?.avatar || 'icons/svg/mystery-man.svg'; // 기본 이미지 fallback 추가

        const { characterIds, statType, difficulty } = await new Promise((resolve) => {
            new StatCheckDialog((characterIds, statType, difficulty) => {
                resolve({ characterIds, statType, difficulty });
            }).render(true);
        });
    
        if (!characterIds?.length) return;
    
        const characters = characterIds.map(id => game.actors.get(id)).filter(Boolean);
        
        const content = `
      <div class="stat-check-request" style="
        background: #f0f0f0;
        border-radius: 10px;
        padding: 12px;
        margin: 8px 0;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        
        <div style="
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            background: white;
            padding: 8px;
            border-radius: 6px;">
            <div style="display:flex;align-items:center;gap:8px;">
                <img src="${gmAvatar}" alt="GM" style="
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    border: 2px solid #ddd;
                    object-fit: cover;">
            </div>
            <h3 style="margin: 0; font-size: 14px; color: #4a4a4a;">
                ${this.getStatLabel(statType)} 판정
            </h3>
            <span style="
                font-size: 14px;
                color: #4a4a4a;
                padding: 4px 8px;
                border-radius: 4px;
                background: #f5f5f5;
                font-weight: bold;">
                난이도: ${difficulty}
            </span>
        </div>
        
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${characters.map(char => `
                    <div style="
                        display: flex;
                        align-items: center;
                        background: white;
                        padding: 8px;
                        border-radius: 6px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                        
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            flex-grow: 1;">
                            <img src="${char.img}" alt="${char.name}" style="
                                width: 36px;
                                height: 36px;
                                border-radius: 50%;
                                border: 2px solid #ddd;
                                object-fit: cover;">
                            <span style="font-weight: bold; color: #4a4a4a;">
                                ${char.name}
                            </span>
                        </div>
        
                        <div class="defense-controls">
                            <button class="stat-check-button" 
                                    data-character-id="${char.id}" 
                                    data-stat-type="${statType}" 
                                    data-difficulty="${difficulty}"
                                    style="
                                        width: 120px;
                                        padding: 6px 12px;
                                        background: white;
                                        border: 1px solid #ddd;
                                        border-radius: 4px;
                                        cursor: pointer;
                                        font-weight: bold;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        gap: 6px;
                                        color: #4a4a4a;
                                        transition: all 0.2s ease;">
                                <i class="fas fa-dice-d20"></i>
                                판정하기
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    
        await ChatMessage.create({
            content: content,
            speaker: ChatMessage.getSpeaker({ alias: "System" })
        });
    }

    static getStatLabel(statType) {
        const statLabels = {
            convalue: "체력",
            reflecvalue: "반사",
            pervalue: "지각",
            intvalue: "이지",
            willvalue: "의지",
            luckvalue: "행운",
            hit: "명중",
            evasion: "회피",
            shelling: "포격",
            pro: "방벽",
            init: "행동"
        };
        return statLabels[statType] || statType;
    }

    static async performCheck(characterId, statType, difficulty) {
        const character = game.actors.get(characterId);
        if (!character) return;
    
        const isOwner = character.ownership[game.user.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
        if (!isOwner && !game.user.isGM) {
            ui.notifications.error("자신의 캐릭터만 판정할 수 있습니다.");
            return;
        }
    
        // 수정치 입력 다이얼로그 표시
        new Dialog({
            title: "판정 수정치",
            content: `
                <style>
                    .difficulty-dialog {
                        background: #f5f5f5;
                        padding: 15px;
                        border-radius: 8px;
                    }
                    .form-group {
                        background: white;
                        padding: 12px;
                        border-radius: 6px;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                        margin-bottom: 15px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 8px;
                        color: #4a4a4a;
                        font-weight: bold;
                    }
                    .form-group input {
                        width: 100%;
                        padding: 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        background: white;
                        height: 38px;
                        font-size: 14px;
                    }
                    .form-group input:focus {
                        border-color: #4a4a4a;
                        box-shadow: 0 0 0 2px rgba(74,74,74,0.2);
                        outline: none;
                    }
                </style>
                <div class="difficulty-dialog">
                    <div class="form-group">
                        <label>추가 수정치:</label>
                        <input type="number" name="additional_difficulty" value="0">
                    </div>
                </div>
            `,
            buttons: {
                roll: {
                    icon: '<i class="fas fa-dice"></i>',
                    label: "판정",
                    callback: async (html) => {
                        const additionaldifficulty = parseInt(html.find('[name="additional_difficulty"]').val()) || 0;
                        const baseValue = character.system.props[statType] || 0;
                        const formula = `2d6 + ${baseValue} + ${additionaldifficulty}`;
                        const roll = await new Roll(formula).evaluate({async: true});
                    
                        if (game.dice3d) {
                            await game.dice3d.showForRoll(roll);
                        }
    
                        // 성공 여부를 난이도와 비교하여 판단
                        const success = roll.total >= difficulty;
    
                        // 주사위 결과
                        const diceResults = roll.terms
                            .filter(term => term.faces === 6)
                            .map(term => term.results.map(r => `
                                <div class="roll die" style="
                                    width: 24px;
                                    height: 24px;
                                    background: white;
                                    border: 2px solid #4a4a4a;
                                    border-radius: 6px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-weight: bold;
                                    font-size: var(--font-size-12);
                                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                    ${r.result}
                                </div>`).join('')).join('');
    
                        // 채팅 메시지에 결과 표시를 위한 HTML 생성
                        const messages = game.messages.contents.slice(-20).reverse();
                        for (const message of messages) {
                            if (!message.content.includes('stat-check-button')) continue;
    
                            const content = message.content;
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(content, 'text/html');
    
                            const checkControl = doc.querySelector(
                                `.stat-check-button[data-character-id="${characterId}"]`
                            )?.closest('.defense-controls');
    
                            if (checkControl) {
                                checkControl.innerHTML = `
                                    <div style="
                                        background: white;
                                        border-radius: 8px;
                                        padding: 8px;
                                        margin-top: 6px;
                                        box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                                        
                                        <div style="
                                            display: flex;
                                            align-items: center;
                                            justify-content: space-between;
                                            margin-bottom: 4px;">
                                            <span style="
                                                font-size: var(--font-size-12);
                                                color: #666;">
                                                2d6 + ${baseValue}${additionaldifficulty !== 0 ? ` + ${additionaldifficulty}` : ''} vs ${difficulty}
                                            </span>
                                        </div>
                                    
                                        <div style="
                                            display: flex;
                                            flex-direction: column;
                                            gap: 4px;">
                                            <div style="
                                                display: flex;
                                                align-items: center;
                                                gap: 4px;
                                                background: #f8f9fa;
                                                border-radius: 6px;
                                                padding: 4px 8px;">
                                                <div style="display: flex; gap: 4px;">
                                                    ${diceResults}
                                                </div>
                                                <span style="
                                                    font-size: var(--font-size-16);
                                                    font-weight: bold;
                                                    padding: 2px 8px;
                                                    background: #4a4a4a;
                                                    color: white;
                                                    border-radius: 4px;
                                                    white-space: nowrap;">
                                                    ${roll.total}
                                                </span>
                                            </div>
                                            
                                            <div style="
                                                text-align: center;
                                                font-size: var(--font-size-14);
                                                color: ${success ? '#28a745' : '#dc3545'};
                                                font-weight: bold;">
                                                ${success ? '성공' : '실패'}
                                            </div>
                                        </div>
                                    </div>`;
                                await this.socket.executeAsGM('updateChatMessageAsGM', message.id, {
                                    content: doc.body.innerHTML
                                });
                                break;
                            }
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소"
                }
            },
            default: "roll"
        }).render(true);
    }
}

// 이벤트 리스너 등록
Hooks.on('renderChatMessage', (message, html) => {
    html.find('.stat-check-button').click(async (event) => {
        const button = event.currentTarget;
        const characterId = button.dataset.characterId;
        const statType = button.dataset.statType;
        const difficulty = Number(button.dataset.difficulty);

        await StatCheck.performCheck(characterId, statType, difficulty);
        button.disabled = true;
    });
});

// GM 메뉴에 능력치 판정 요청 추가
Hooks.on('getSceneControlButtons', (controls) => {
    if (game.user.isGM) {
        const tokenControls = controls.find(c => c.name === "token");
        if (tokenControls) {
            tokenControls.tools.push({
                name: "request-stat-check",
                title: "능력치/전투치 판정 요청",
                icon: "fas fa-dice-d20",
                button: true,
                onClick: () => StatCheck.requestCheck()
            });
        }
    }
});