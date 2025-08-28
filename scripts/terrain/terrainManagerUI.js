// terrainManagerUI.js

export class TerrainManagerUI {

    static addControls(controls) {
        const tileControls = controls.find(c => c.name === "tiles");
        if (!tileControls) return;

        if (tileControls.tools.some(t => t.name === "terrain-management")) return;

        tileControls.tools.push({
            name: "terrain-management",
            title: "지형 관리",
            icon: "fas fa-layer-group",
            visible: game.user.isGM,
            button: true,
            onClick: () => this.showManager()
        });
    }

    static get defaultTerrains() {
        return {
            normal: {
                id: 'normal',
                name: '일반',
                icon: '🔲',
                img: 'modules/metalic-combat-system/assets/terrains/통상.png',
                effects: [],
                description: '특별한 효과가 없는 일반 지형입니다.'
            },
            rough: {
                id: 'rough',
                name: '차폐물',
                icon: '⛰️',
                img: 'modules/metalic-combat-system/assets/terrains/차폐물.png',
                effects: ['진입시 2마스 분의 이동력 필요', '부분차폐'],
                description: '키가 큰 삼림이나, 잡거빌딩 등 사선을 어느 정도 가리나, 침입은 가능한 지형을 나타낸다. 스퀘어 상에 「▼」표시를 기입해서 표기할 것. \n\n차폐물 스퀘어에 들어가기 위해서는 2마스만큼 이동력이 필요하며, 부분차폐를 제공한다.  \n\n비행상태나 질주상태, 지중상태라면, 【이동력】에 대한 수정은 받지 않는다.'
            },
            blockade: {
                id: 'blockade',
                name: '봉쇄',
                icon: '⚪',
                img: 'modules/metalic-combat-system/assets/terrains/봉쇄.png',
                effects: ['이탈 시 【행동치】에 의한 대결'],
                description: '매우 좁고 험한 길이나 터널 속 등, 적이 가로막아 서는 경우에 그 움직임이 제한되는 장소를 봉쇄 스퀘어라 부른다. 스퀘어 상에 「○」표시를 기입해서 표기할 것. \n\n봉쇄 스퀘어에 적이 있어, 적 스퀘어가 된 경우, 그 스퀘어로부터의 이탈이동에는 【행동치】에 의한 대결이 필요하다.\n\n이탈이동을 하는 캐릭터는, 적 스퀘어 내의 적 캐릭터와 【행동치】로 대결을 하고, 여기서 승리해야 한다. 복수의 적과 같은 스퀘어에 있는 경우는, 그 전부에게 승리할 필요가 있다.\n\n 대결에 패배했을 경우, 당연하게도 그 스퀘어로부터의 이탈은 할 수 없다. '
            },
            oppress: {
                id: 'oppress',
                name: '제압',
                icon: '⚫',
                img: 'modules/metalic-combat-system/assets/terrains/제압.png',
                effects: ['진입 시 전력이동 필요'],
                description: '봉쇄와는 반대로, 다른 이익을 살려 적의 침입을 도와주는 장소를 제압 스퀘어라 부른다. 스퀘어 상에 「●」표시를 기입해서 표기할 것.\n\n 제압 스퀘어는 반드시 적 스퀘어가 된다. 제압 스퀘어에 들어가려면, 필히 전력이동을 해야만하며, 전투이동이나 이탈이동으로 제압 스퀘어에 들어갈 수는 없다.\n\n역으로 말하자면, 제압 스퀘어로 둘러쌓인 스퀘어에 있을 경우, 이탈이동을 할 수 없다.'
            },
            restricted: {
                id: 'restricted',
                name: '진입불능',
                icon: '⬛',
                img: 'modules/metalic-combat-system/assets/terrains/진입불능.png',
                effects: ['진입불가','완전차폐'],
                description: '궤도 엘레베이터가 있는, 거대한 빌딩 등으로, 비행을 가지고 있어도 진입할 수 없는 스퀘어. 지하공동이나 콜로니의 벽 등도 이에 해당한다.\n\n스퀘어를 검게 칠할 것. 이 스퀘어에는 진입할 수 없다.'
            },
            obstacle: {
                id: 'obstacle',
                name: '장해물',
                icon: '▲',
                img: 'modules/metalic-combat-system/assets/terrains/장해물.png',
                effects: ['비행 상태 외 진입불가', '부분차폐'],
                description: '산이나 바위, 빌딩 따위의 장해물 등으로, 진입할 수 없는 스퀘어. 스퀘어 상에 「▲」표시를 기입해서 표기할 것.\n\n 장애물 스퀘어는 비행 상태면 진입할 수 있다.\n\n 사선 상에 장해물 스퀘어가 있을 경우, [부분차폐]가 된다. 부분차폐를 사이에 끼고 공격을 할 경우, 리액션측의 달성치는 +2 가 된다.'
            },
            Difficultymoving : {
                id: 'obstacle',
                name: '장해물',
                icon: '⛛',
                img: 'modules/metalic-combat-system/assets/terrains/이동곤란.png',
                effects: ['진입시 2마스 분의 이동력 필요'],
                description: '경사면의 숲이나 수풀 등 진입이 곤란한 스퀘어. 스퀘어 상에 「▽」표시를 기입해서 표기할 것.\n\n이동곤란 스퀘어에 들어가려면, 2마스 분의 이동력이 필요하다. 비행 상태나 질주 상태라면, 【이동력】에 대한 수정은 받지 않는 것으로 한다.'
            },
            desert : {
                id: 'desert',
                name: '사막',
                icon: '/',
                img: 'modules/metalic-combat-system/assets/terrains/사막.png',
                effects: ['진입시 2마스 분의 이동력 필요', '리액션 달성치 -5'],
                description: '사막이나 설원을 포함하는 스퀘어. 스퀘어에 사선을 그어 표기한다.\n\n 이 스퀘어에 들어가려면, 2마스 분의 이동력이 필요하다. 또, 이 스퀘어 내에 있는 캐릭터는, 리액션의 달성치가  이 스퀘어에 들어가려면, 2매스 분의 이동력이 필요하다. 또, 이 스퀘어 내에 있는 캐릭터는, 리액션의 달성치가 –5 된다. 비행 상태나 질주 상태라면, 【이동력】이나 리액션에 대한 수정은 받지 않는 것으로 한다.'
            },
            water : {
                id: 'water',
                name: '수지',
                icon: '水',
                img: 'modules/metalic-combat-system/assets/terrains/수지.png',
                effects: ['진입시 2마스 분의 이동력 필요', '리액션 달성치 -5'],
                description: '강이나 바다, 또는 늪지를 나타내는 스퀘어. 스퀘어 상에 「水」표시를 기입해서 표기할 것.\n\n 이 스퀘어에 들어가려면, 2마스 분의 이동력이 필요하다. 또, 이 스퀘어 내에 있는 캐릭터는, 리액션의 달성치가 -5 된다.'
            },
            deepwater : {
                id: 'deepwater',
                name: '수중',
                icon: '深',
                img: 'modules/metalic-combat-system/assets/terrains/심수.png',
                effects: ['진입시 2마스 분의 이동력 필요', '리액션 달성치 -5', '가하는 데미지 절반'],
                description: '수지 스퀘어의 특성에 더하여, 그 곳에 있는 캐릭터 전원이 물 속에 가라앉을 정도로 깊은 스퀘어. 스퀘어 상에 「深」표시를 기입해서 표기할 것. 또한, 기체의 사이즈마다 완전히 물에 잠기는 깊이는 다르지만, 자세한 것은 GM이 판단할 것.\n\n수지 스퀘어의 특성에 더하여, 가하는 데미지가 절반이 된다. 비행 상태나 질주 상태라면, 【이동력】이나 리액션에 대한 수정은 받지 않는 것으로 한다.'
            },
            run : {
                id: 'run',
                name: '도주',
                icon: '❌',
                img: 'modules/metalic-combat-system/assets/terrains/도주.png',
                effects: ['도주 가능'],
                description: '전투가 벌어지고 있는 씬에서 달아나는(퇴장하는) 것이 가능한 스퀘어. 스퀘어 상에 「X」표시를 기입해서 표기할 것.\n\n도주하는 캐릭터는, 이 스퀘어에 들어가는 것으로 이 씬에서 퇴장 할 수 있다. 단, 이 스퀘어가 적 스퀘어로 되어있는 경우, 퇴장할 수 없다. 또한, GM은 퇴장을 인정하지 않아도 좋다.'
            },
            base : {
                id: 'base',
                name: '기지',
                icon: '⭐',
                img: 'modules/metalic-combat-system/assets/terrains/기지.png',
                effects: [],
                description: '가디언을 조종하지 않고 전투에 참가하는 캐릭터는, 원칙적으로 이 기지 스퀘어에 있는 것으로 취급한다. 스퀘어 상에 「☆」표시를 기입해서 표기할 것.\n\n 특기 등의 사용에 있어, 사정거리가 중요한 경우는 이 스퀘어로부터 계산하는 것이 된다. 시야의 확인도, 이 스퀘어에서 행할 것.'
            },
            obstruct : {
                id: 'obstruct',
                name: '시야차단',
                icon: '∥',
                img: 'modules/metalic-combat-system/assets/terrains/시계차단.png',
                effects: ['완전차폐'],
                description: '특수한 필드가 펼쳐지거나, 연막이나 안개로 시야가 막히는 등, 침입하는 것은 가능하나 사선이 닿지 않는 스퀘어. 스퀘어의 위에 「∥」의 마크를 기입하여 표기할 것.\n\n 이 스퀘어는 침입불가 스퀘어처럼 완전차폐를 제공한다. 또한, 이 스퀘어 안에 있는 캐릭터에게도, 마찬가지로 사선은 닿지 않으므로 주의할 것. 이것은 같은 스퀘어 안에 있는 경우라도 마찬가지다.'
            },
            snow : {
                id: 'snow',
                name: '설지',
                icon: '⌧',
                img: 'modules/metalic-combat-system/assets/terrains/설지.png',
                effects: ['진입시 2마스 분의 이동력 필요', '리액션 달성치 -5'],
                description: '눈이 대량으로 쌓여 있거나, 일면이 얼음으로 뒤덮히는 등으로, 행동에 지장이 생기는 스퀘어. 스퀘어 상에 「⌧」표시를 기입해서 표기한다.\n\n 이 스퀘어에 들어가기 위해서는, 2마스 만큼의 이동력이 필요하다. 또, 이 스퀘어 안에 있는 캐릭터는, 리액션의 달성치가 -5된다.'
            },
            reef : {
                id: 'reef',
                name: '암초공역',
                icon: '=',
                img: 'modules/metalic-combat-system/assets/terrains/암초공역.png',
                effects: ['진입시 2마스 분의 이동력 필요', '리액션 달성치 -5'],
                description: '큰 데브리나 가디언 사이즈의 바윗덩이가 굴러다니며, 이동과 행동을 방해하는 스퀘어. 스퀘어 위에 「=」표시를 기입해서 표기한다.\n\n 이 스퀘어에 들어가기 위해서는, 2마스 만큼의 이동력이 필요하다. 또, 이 스퀘어의 안에 있는 캐릭터는, 리액션의 달성치가 -5된다.'
            },
            congestion : {
                id: 'congestion',
                name: '밀집',
                icon: '#',
                img: 'modules/metalic-combat-system/assets/terrains/밀집공역.png',
                effects: ['진입시 2마스 분의 이동력 필요', '부분차폐'],
                description: '데브리나 소행성이 밀집해서 진입할 수 없지만 시야는 통하는 스퀘어. 스퀘어 상에 「#」표시를 기입해서 표기한다.\n\n 이 스퀘어는 진입은 할 수 없지만, 사선이나 시야는 닿는다. 또, 부분차폐를 제공한다.'
            }
        }
    };

    static async showManager() {
        const terrains = game.settings.get('metalic-combat-system', 'terrainDefinitions');
        
        const content = await this._getManagerHTML(terrains);
        
    return new Promise((resolve) => {
        new terrainManagerDialog({
            title: "지형 관리",
            content,
            buttons: {
                add: {
                    icon: '<i class="fas fa-plus"></i>',
                    label: "새 지형",
                    callback: () => this._showTerrainCreationDialog()
                },
                import: {
                    icon: '<i class="fas fa-file-import"></i>',
                    label: "가져오기",
                    callback: () => this._importTerrains()
                },
                export: {
                    icon: '<i class="fas fa-file-export"></i>',
                    label: "내보내기",
                    callback: () => this._exportTerrains()
                },
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "닫기"
                }
            },
            render: html => this._activateListeners(html),
            width: 800
        }).render(true);
    }
)}

    static async _getManagerHTML(terrains) {
        return `
        <style>
            .app.dialog {
                width: 800px !important;
            }
            .dialog .dialog-content {
                width: 100% !important;
                max-width: none !important;
            }
            .window-content {
                width: 100% !important;
                max-width: none !important;
            }        
            .terrain-manager {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .terrain-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1rem;
                max-height: 600px;
                overflow-y: auto;
                padding: 1rem;
                background: #f5f5f5;
                border-radius: 8px;
            }
            
            .terrain-card {
                background: white;
                border-radius: 8px;
                padding: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .terrain-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
            }
            
            .terrain-title {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-weight: bold;
            }
            
            .terrain-icon {
                font-size: 1.5rem;
            }
            
            .terrain-image {
                width: 100%;
                height: 120px;
                object-fit: cover;
                border-radius: 4px;
            }
            
            .terrain-effects {
                display: flex;
                flex-wrap: wrap;
                gap: 0.25rem;
            }
            
            .effect-tag {
                background: #e9ecef;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.875rem;
            }
            
            .terrain-actions {
                display: flex;
                gap: 0.5rem;
                margin-top: auto;
            }
            
            .terrain-button {
                padding: 0.25rem 0.5rem;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.875rem;
            }
            
            .edit-button {
                background: #4a4a4a;
                color: white;
            }
            
            .delete-button {
                background: #dc3545;
                color: white;
            }
            
            .custom-terrain {
                border: 2px solid #4a4a4a;
            }
        </style>
        
        <div class="terrain-manager">
            <div class="terrain-grid">
                ${Object.entries(terrains).map(([id, terrain]) => `
                    <div class="terrain-card ${this.defaultTerrains[id] ? '' : 'custom-terrain'}" data-terrain-id="${id}">
                        <div class="terrain-header">
                            <div class="terrain-title">
                                <span class="terrain-icon">${terrain.icon}</span>
                                <span>${terrain.name}</span>
                            </div>
                        </div>
                        
                        <img class="terrain-image" src="${terrain.img}" alt="${terrain.name}">
                        
                        <div class="terrain-effects">
                            ${terrain.effects.map(effect => `
                                <span class="effect-tag">${effect}</span>
                            `).join('')}
                        </div>
                        
                        <div class="terrain-description" style="font-size: 0.875rem; color: #666;">
                            ${terrain.description}
                        </div>
                        
                        ${this.defaultTerrains[id] ? '' : `
                            <div class="terrain-actions">
                                <button class="terrain-button edit-button" data-action="edit">
                                    <i class="fas fa-edit"></i> 수정
                                </button>
                                <button class="terrain-button delete-button" data-action="delete">
                                    <i class="fas fa-trash"></i> 삭제
                                </button>
                            </div>
                        `}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

static async _showTerrainCreationDialog(terrain = null) {
    const isEdit = !!terrain;
    
    new Dialog({
        title: `지형 ${isEdit ? '수정' : '생성'}`,
        content: `
            <style>
                .terrain-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .form-group label {
                    font-weight: bold;
                }
                
                .form-group input,
                .form-group textarea {
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                
                .image-picker {
                    display: flex;
                    gap: 0.5rem;
                    align-items: center;
                }

                .image-preview {
                    width: 50px;
                    height: 50px;
                    object-fit: cover;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                }
            </style>
            
            <form class="terrain-form">
                <div class="form-group">
                    <label>지형 이름</label>
                    <input type="text" name="name" value="${terrain?.name || ''}" required>
                </div>
                
                <div class="form-group">
                    <label>아이콘 (이모지)</label>
                    <input type="text" name="icon" value="${terrain?.icon || ''}" required>
                </div>
                
                <div class="form-group">
                    <label>이미지</label>
                    <div class="image-picker">
                        <input type="text" name="img" value="${terrain?.img || ''}" required>
                        <button type="button" class="file-picker" data-type="image" data-target="img">
                            <i class="fas fa-file-import"></i></button>
                        ${terrain?.img ? `
                            <img class="image-preview" src="${terrain.img}" alt="지형 이미지">
                        ` : ''}
                    </div>
                </div>
                
                <div class="form-group">
                    <label>효과 (줄바꿈으로 구분)</label>
                    <textarea name="effects">${terrain?.effects.join('\n') || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label>설명</label>
                    <textarea name="description">${terrain?.description || ''}</textarea>
                </div>
            </form>
        `,
        buttons: {
            save: {
                icon: '<i class="fas fa-save"></i>',
                label: isEdit ? "저장" : "생성",
                callback: html => this._saveTerrain(html, terrain?.id)
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "취소"
            }
        },
        default: "save",
        width: 500,
        render: html => {
            // FilePicker 초기화
            const picker = html.find(".file-picker");
            picker.on("click", event => {
                event.preventDefault();
                const button = event.currentTarget;
                const input = html.find(`input[name="${button.dataset.target}"]`);
                const fp = new FilePicker({
                    type: button.dataset.type,
                    current: input.val(),
                    callback: path => {
                        input.val(path);
                        // 이미지 프리뷰 업데이트
                        const preview = html.find(".image-preview");
                        if (preview.length) {
                            preview.attr("src", path);
                        } else {
                            html.find(".image-picker").append(`
                                <img class="image-preview" src="${path}" alt="지형 이미지">
                            `);
                        }
                    },
                    // 기본 경로를 모듈의 terrain 폴더로 설정
                    FilePicker: {
                        browseEndpoint: "", 
                        target: "modules/metalic-combat-system/assets/terrains"
                    }
                });
                fp.browse();
            });

            // 이미지 입력값 변경 시 프리뷰 업데이트
            html.find('input[name="img"]').on('change', event => {
                const path = event.currentTarget.value;
                const preview = html.find(".image-preview");
                if (preview.length) {
                    preview.attr("src", path);
                } else {
                    html.find(".image-picker").append(`
                        <img class="image-preview" src="${path}" alt="지형 이미지">
                    `);
                }
            });
        }
    }).render(true);
}

    static async _saveTerrain(html, existingId = null) {
        const form = html.find('form')[0];
        const formData = new FormData(form);
        
        const terrainData = {
            id: existingId || formData.get('name').toLowerCase().replace(/\s+/g, '_'),
            name: formData.get('name'),
            icon: formData.get('icon'),
            img: formData.get('img'),
            effects: formData.get('effects').split('\n').filter(e => e.trim()),
            description: formData.get('description')
        };
        
        try {
            const terrains = game.settings.get('metalic-combat-system', 'terrainDefinitions');
            
            if (!existingId && terrains[terrainData.id]) {
                ui.notifications.error("같은 ID의 지형이 이미 존재합니다.");
                return;
            }
            
            terrains[terrainData.id] = terrainData;
            await game.settings.set('metalic-combat-system', 'terrainDefinitions', terrains);
            
            // TerrainManager의 terrains 업데이트
            if (game.terrain?.manager) {
                game.terrain.manager.terrains = terrains;
            }
            
            ui.notifications.info(`지형이 ${existingId ? '수정' : '생성'}되었습니다.`);
            this.showManager();
            
        } catch (error) {
            console.error('지형 저장 중 오류:', error);
            ui.notifications.error("지형 저장에 실패했습니다.");
        }
    }

    static async _deleteTerrain(id) {
        try {
            const terrains = game.settings.get('metalic-combat-system', 'terrainDefinitions');
            
            if (this.defaultTerrains[id]) {
                ui.notifications.error("기본 지형은 삭제할 수 없습니다.");
                return;
            }
            
            delete terrains[id];
            await game.settings.set('metalic-combat-system', 'terrainDefinitions', terrains);
            
            if (game.terrain?.manager) {
                game.terrain.manager.terrains = terrains;
            }
            
            // 기존 매니저 창 찾기
            const existingDialog = Object.values(ui.windows).find(w => 
                w.title === "지형 관리"
            );
            
            if (existingDialog) {
                // 기존 창의 내용만 업데이트
                const newContent = await this._getManagerHTML(terrains);
                const element = existingDialog.element;
                element.find('.dialog-content').html(newContent);
                this._activateListeners(element);
            }
            
            ui.notifications.info("지형이 삭제되었습니다.");
            
        } catch (error) {
            console.error('지형 삭제 중 오류:', error);
            ui.notifications.error("지형 삭제에 실패했습니다.");
        }
    }

    static async _importTerrains() {
        new Dialog({
            title: "지형 가져오기",
            content: `
                <div class="form-group">
                    <label>JSON 데이터</label>
                    <textarea style="height: 200px;"></textarea>
                </div>
            `,
            buttons: {
                import: {
                    icon: '<i class="fas fa-file-import"></i>',
                    label: "가져오기",
                    callback: html => {
                        try {
                            const jsonData = JSON.parse(html.find('textarea').val());
                            this._processImport(jsonData);
                        } catch (error) {
                            ui.notifications.error("잘못된 JSON 형식입니다.");
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소"
                }
            }
        }).render(true);
    }

    static async _processImport(jsonData) {
        try {
            const terrains = game.settings.get('metalic-combat-system', 'terrainDefinitions');
            
            // 기존 지형과 병합
            const newTerrains = { ...terrains, ...jsonData };
            
            await game.settings.set('metalic-combat-system', 'terrainDefinitions', newTerrains);

            if (game.terrain?.manager) {
                game.terrain.manager.terrains = newTerrains;
            }
            
            ui.notifications.info("지형을 가져왔습니다.");
            this.showManager();
            
        } catch (error) {
            console.error('지형 가져오기 중 오류:', error);
            ui.notifications.error("지형 가져오기에 실패했습니다.");
        }
    }

    static _exportTerrains() {
        const terrains = game.settings.get('metalic-combat-system', 'terrainDefinitions');
        
        // 사용자 정의 지형만 내보내기
        const customTerrains = Object.entries(terrains)
            .filter(([id]) => !this.defaultTerrains[id])
            .reduce((acc, [id, terrain]) => ({ ...acc, [id]: terrain }), {});
        
        const jsonStr = JSON.stringify(customTerrains, null, 2);
        
        new Dialog({
            title: "지형 내보내기",
            content: `
                <div class="form-group">
                    <label>JSON 데이터</label>
                    <textarea style="height: 200px;" readonly>${jsonStr}</textarea>
                </div>
            `,
            buttons: {
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "닫기"
                }
            }
        }).render(true);
    }

    static _activateListeners(html) {
        html.find('.edit-button').click(ev => {
            const id = ev.currentTarget.closest('.terrain-card').dataset.terrainId;
            const terrains = game.settings.get('metalic-combat-system', 'terrainDefinitions');
            this._showTerrainCreationDialog(terrains[id]);
        });
        
        html.find('.delete-button').click(ev => {
            const id = ev.currentTarget.closest('.terrain-card').dataset.terrainId;
            
            new Dialog({
                title: "지형 삭제",
                content: "정말 이 지형을 삭제하시겠습니까?",
                buttons: {
                    delete: {
                        icon: '<i class="fas fa-trash"></i>',
                        label: "삭제",
                        callback: () => this._deleteTerrain(id)
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "취소"
                    }
                }
            }).render(true);
        });
    }
}

class terrainManagerDialog extends Dialog {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["terrainManager-dialog"],
            width: 800,
            height: 700,
            resizable: true
        });
    }
}