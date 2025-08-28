import { StatusEffectManager } from './StatusEffectManager.js';
import { CombatInfoManager } from './CombatInfoManager.js';
import { TemplateManager } from './TemplateManager.js';

export class ActorStatusManager {
    static ID = 'metalic-combat-system';
    static socket = null;
    static window = null;
    static CSS_PREFIX = 'mcs-status';

    static initialize(socketlib) {
        if (!socketlib) {
            console.error('[ActorStatusManager] No socketlib provided');
            return false;
        }

        try {
            this.socket = socketlib;
            window.ActorStatusManager = this;

            // 소켓 핸들러 등록
            this._registerSocketHandlers();
            // 스타일 주입
            this._injectStyles();
            // 후크 등록
            this._registerHooks();

            return true;
        } catch (error) {
            console.error('[ActorStatusManager] Initialization error:', error);
            return false;
        }
    }

    static _registerSocketHandlers() {
        this.socket.register('updateResource', this._handleResourceUpdate.bind(this));
        this.socket.register('toggleBless', this._handleToggleBless.bind(this));
    }

    static _injectStyles() {
        const styles = `
            .${this.CSS_PREFIX}-window {
                background: rgba(0, 0, 0, 0.85);
                border: 1px solid #666;
                border-radius: 8px;
                padding: 12px;
                position: fixed;
                right: 315px;
                top: 5px;
                width: 300px;
                color: white;
                z-index: 100;
                font-size: 12px;
                max-height: calc(100vh - 20px);
                overflow-y: auto;
                cursor: move;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
            }

            .${this.CSS_PREFIX}-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            }

            .${this.CSS_PREFIX}-title {
                font-weight: bold;
                font-size: 14px;
                color: #fff;
            }

            .${this.CSS_PREFIX}-controls {
                display: flex;
                gap: 8px;
            }

            .${this.CSS_PREFIX}-control-button {
                background: none;
                border: none;
                color: #ccc;
                cursor: pointer;
                padding: 4px;
                transition: color 0.2s;
            }

            .${this.CSS_PREFIX}-control-button:hover {
                color: #fff;
            }

            .${this.CSS_PREFIX}-tabs {
                display: flex;
                gap: 4px;
                margin-bottom: 10px;
            }

            .${this.CSS_PREFIX}-tab-button {
                flex: 1;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                padding: 6px 12px;
                color: #ccc;
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.2s;
                display: flex;          
                align-items: center;    
                justify-content: center; 
                gap: 6px;            
                white-space: nowrap;  
                min-width: fit-content; 
            }

            .${this.CSS_PREFIX}-tab-button i {
                margin-right: 4px;
            }            

            .${this.CSS_PREFIX}-tab-button:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            .${this.CSS_PREFIX}-tab-button.active {
                background: rgba(255, 255, 255, 0.3);
                color: white;
            }

            .${this.CSS_PREFIX}-tab-content {
                display: none;
            }

            .${this.CSS_PREFIX}-tab-content.active {
                display: block;
            }

            .${this.CSS_PREFIX}-actor-card {
                background: rgba(255, 255, 255, 0.1);
                border-radius: 6px;
                padding: 10px;
                margin-bottom: 8px;
            }

            .${this.CSS_PREFIX}-actor-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 8px;
            }

            .${this.CSS_PREFIX}-actor-image {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                cursor: pointer;
                transition: transform 0.2s;
            }

            .${this.CSS_PREFIX}-actor-image:hover {
                transform: scale(1.1);
            }

            .${this.CSS_PREFIX}-actor-name {
                font-weight: bold;
                font-size: 14px;
                color: #fff;
            }
        `;

        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }

    static _registerHooks() {
        // 액터 업데이트 시 화면 갱신
        Hooks.on('updateActor', (actor, changes) => {
            if (this.window && changes.system?.props) {
                this.updateDisplay();
            }
        });
    
        // 아이템 생성 시 화면 갱신
        Hooks.on('createItem', (item) => {
            if (this.window && item.parent instanceof Actor && 
                (item.system?.props?.type === 'bless' || 
                 item.system?.props?.type === 'weapon')) {
                this.updateDisplay();
            }
        });
    
        // 아이템 삭제 시 화면 갱신
        Hooks.on('deleteItem', (item) => {
            if (this.window && item.parent instanceof Actor && 
                (item.system?.props?.type === 'bless' || 
                 item.system?.props?.type === 'weapon')) {
                this.updateDisplay();
            }
        });
    
        // 아이템 업데이트 시 화면 갱신
        Hooks.on('updateItem', (item, changes) => {
            console.log('Item updated:', item, changes);
            if (this.window && 
                (item.system?.props?.type === 'bless' || 
                 item.system?.props?.type === 'weapon')) {
                this.updateDisplay();
            }
        });
    
        // 효과 관련 Hooks
        Hooks.on('createActiveEffect', () => {
            if (this.window) {
                this.updateDisplay();
            }
        });
    
        Hooks.on('deleteActiveEffect', () => {
            if (this.window) {
                this.updateDisplay();
            }
        });
    
        Hooks.on('updateActiveEffect', () => {
            if (this.window) {
                this.updateDisplay();
            }
        });
    
        // 토큰 업데이트 시
        Hooks.on('updateToken', (token, changes, options, userId) => {
            if (changes.effects && this.window && token.actor) {
                const actorCard = this.window.querySelector(`[data-actor-id="${token.actor.id}"]`);
                if (actorCard) {
                    const effectsContainer = actorCard.querySelector('.status-effects-container');
                    if (effectsContainer) {
                        effectsContainer.outerHTML = StatusEffectManager.createEffectIconsHTML(token.actor);
                        this._setupStatusEffectListeners();
                    }
                }
            }
        });
    }

    static show() {
        if (this.window) {
            this.window.style.display = 'block';
            this.updateDisplay();
            return;
        }
 
        this.window = document.createElement('div');
        this.window.className = `${this.CSS_PREFIX}-window`;
 
        // 저장된 위치가 있다면 적용
        const savedPosition = game.settings.get(this.ID, 'actorStatusPosition');
        if (savedPosition) {
            this.window.style.top = `${savedPosition.top}px`;
            this.window.style.right = `${savedPosition.right}px`;
        }
 
        document.body.appendChild(this.window);
        this._makeDraggable();
        this.updateDisplay();
    }
 
    static hide() {
        if (this.window) {
            this.window.style.display = 'none';
        }
    }
 
    static isVisible() {
        return this.window && this.window.style.display !== 'none';
    }
 
    static updateDisplay(activeTabName = null) {
        if (!this.window) return;
    
        console.log('updateDisplay called with activeTabName:', activeTabName);
    
        // 현재 활성화된 탭 확인
        if (!activeTabName) {
            const activeTab = this.window.querySelector(`.${this.CSS_PREFIX}-tab-button.active`);
            activeTabName = activeTab?.dataset.tab || 'resources';
            console.log('Current active tab:', activeTabName);
        }
    
        const settings = game.settings.get(this.ID, 'actorWidgetSettings') || {};
        const actors = game.actors.filter(a => {
            const isSelected = Object.keys(settings).length === 0 || settings[a.id];
            if (!isSelected) return false;
            
            // GM은 모든 캐릭터를 볼 수 있음
            if (game.user.isGM) return true;
            
            // 소유 또는 관찰 권한이 있는 캐릭터 필터링
            return Object.entries(a.ownership).some(([userId, level]) => {
                const user = game.users.get(userId);
                return !user?.isGM && level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
            });
        });
    
        const orderSettings = game.settings.get(this.ID, 'actorWidgetOrder') || [];
        const sortedActors = [...actors].sort((a, b) => {
            const indexA = orderSettings.indexOf(a.id);
            const indexB = orderSettings.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    
        let content = `
            <div class="${this.CSS_PREFIX}-header">
                <div class="${this.CSS_PREFIX}-title">캐릭터 상태</div>
                <div class="${this.CSS_PREFIX}-controls">
                    <button class="${this.CSS_PREFIX}-control-button" onclick="ActorStatusManager.showConfig()">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="${this.CSS_PREFIX}-control-button" onclick="ActorStatusManager.minimize()">
                        <i class="fas fa-compress"></i>
                    </button>
                </div>
            </div>
            <div class="${this.CSS_PREFIX}-tabs">
                <button class="${this.CSS_PREFIX}-tab-button ${activeTabName === 'resources' ? 'active' : ''}" 
                        data-tab="resources">
                    <i class="fas fa-heart"></i> 리소스
                </button>
                <button class="${this.CSS_PREFIX}-tab-button ${activeTabName === 'bless' ? 'active' : ''}" 
                        data-tab="bless">
                    <i class="fas fa-crown"></i> 가호
                </button>
                <button class="${this.CSS_PREFIX}-tab-button ${activeTabName === 'combat' ? 'active' : ''}" 
                        data-tab="combat">
                    <i class="fas fa-crosshairs"></i> 전투
                </button>
            </div>
            <div class="${this.CSS_PREFIX}-content">
                <div class="${this.CSS_PREFIX}-tab-content ${activeTabName === 'resources' ? 'active' : ''}" 
                     data-tab="resources">
                    ${this._createResourceContent(sortedActors)}
                </div>
                <div class="${this.CSS_PREFIX}-tab-content ${activeTabName === 'bless' ? 'active' : ''}" 
                     data-tab="bless">
                    ${this._createBlessContent(sortedActors)}
                </div>
                <div class="${this.CSS_PREFIX}-tab-content ${activeTabName === 'combat' ? 'active' : ''}" 
                     data-tab="combat">
                    ${CombatInfoManager ? CombatInfoManager.createCombatInfoHTML(sortedActors) : ''}
                </div>
            </div>`;
    
        console.log('Created content with activeTabName:', activeTabName);
        this.window.innerHTML = content;
        this._setupEventListeners();
    }
 
    static _createResourceContent(actors) {
        if (!actors.length) return '<div class="empty-message">표시할 캐릭터가 없습니다.</div>';
    
        return actors.map(actor => {
            // 액터 데이터 유효성 검사
            if (!actor?.system?.props) {
                console.warn(`Invalid actor data for: ${actor?.name || 'Unknown Actor'}`);
                return ''; // 유효하지 않은 액터는 건너뜀
            }
    
            try {
                const resources = {
                    fp: {
                        current: parseInt(actor.system.props.fpvalue) || 0,
                        max: parseInt(actor.system.props.fpmax) || 0,
                        label: 'FP',
                        color: '#28a745'
                    },
                    hp: {
                        current: parseInt(actor.system.props.hpvalue) || 0,
                        max: parseInt(actor.system.props.hpmax) || 0,
                        label: 'HP',
                        color: '#dc3545'
                    },
                    en: {
                        current: parseInt(actor.system.props.envalue) || 0,
                        max: parseInt(actor.system.props.enmax) || 0,
                        label: 'EN',
                        color: '#17a2b8'
                    }
                };
    
                const guardian = actor.system.props.guardian || '';
                const linkedActors = this._getLinkedActors(actor);
    
                return this._createActorResourceCard(actor, resources, guardian, linkedActors);
            } catch (error) {
                console.warn(`Error creating resource content for actor ${actor?.name}:`, error);
                return ''; // 에러가 발생한 액터는 건너뜀
            }
        }).filter(Boolean).join(''); // 빈 문자열 제거
    }
 
    static _createActorResourceCard(actor, resources, guardian, linkedActors) {
        try {
            return `
                <div class="${this.CSS_PREFIX}-actor-card" data-actor-id="${actor.id}">  
                    <div class="${this.CSS_PREFIX}-actor-header">
                        <img src="${actor.img || 'icons/svg/mystery-man.svg'}" 
                             class="${this.CSS_PREFIX}-actor-image"
                             onclick="ActorStatusManager.openCharacterSheet('${actor.id}')">
                        <div class="${this.CSS_PREFIX}-actor-name">${actor.name || 'Unknown Actor'}</div>
                    </div>
                    ${StatusEffectManager.createEffectIconsHTML(actor)}
                    
                    ${Object.entries(resources)
                        .map(([type, data]) => {
                            try {
                                return this._createResourceBar(type, data, actor.id);
                            } catch (error) {
                                console.warn(`Error creating resource bar for ${type}:`, error);
                                return '';
                            }
                        })
                        .filter(Boolean)
                        .join('')}
                    ${this._createLinkedInfo(guardian, linkedActors)}
                </div>
            `;
        } catch (error) {
            console.warn(`Error creating actor card for ${actor?.name}:`, error);
            return '';
        }
    }
 
    static _createResourceBar(type, data, actorId) {
        const percentage = Math.round((data.current / data.max) * 100) || 0;
        const isLow = percentage <= 25;

        return `
            <div class="${this.CSS_PREFIX}-resource-container">
                <div class="${this.CSS_PREFIX}-resource-label">
                    ${data.label} 
                    <div class="${this.CSS_PREFIX}-resource-value" 
                         onclick="ActorStatusManager.showValueEditor('${actorId}', '${type}', ${data.current}, ${data.max})">
                        ${data.current}/${data.max}
                    </div>
                </div>
                <div class="${this.CSS_PREFIX}-resource-bar ${isLow ? 'warning' : ''}">
                    <div class="${this.CSS_PREFIX}-resource-fill" 
                         style="width: ${percentage}%; background-color: ${data.color};">
                    </div>
                </div>
                <div class="${this.CSS_PREFIX}-resource-controls">
                    <button onclick="ActorStatusManager.adjustResource('${actorId}', '${type}', -5)">-5</button>
                    <button onclick="ActorStatusManager.adjustResource('${actorId}', '${type}', -1)">-1</button>
                    <button onclick="ActorStatusManager.adjustResource('${actorId}', '${type}', 1)">+1</button>
                    <button onclick="ActorStatusManager.adjustResource('${actorId}', '${type}', 5)">+5</button>
                </div>
            </div>
        `;
    }

    static _createLinkedInfo(guardian, linkedActors) {
        if (!guardian && linkedActors.length === 0) return '';
    
        return `
            <div class="${this.CSS_PREFIX}-linked-info">
                ${linkedActors.length > 0 ? `
                    <div class="${this.CSS_PREFIX}-linkage">
                        <i class="fas fa-link"></i> 링케이지: ${linkedActors.map(a => a.name).join(', ')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    static _getLinkedActors(actor) {
        if (actor.system?.props?.type === "guardian") {
            const pilotName = actor.system?.props?.pilotname;
            if (pilotName) {
                // 링케이지(파일럿) 찾기
                const pilot = game.actors.find(a => a.name === pilotName);
                return pilot ? [pilot] : [];
            }
        }
        return [];
    }

    static showValueEditor(actorId, resourceType, current, max) {
        new Dialog({
            title: "리소스 값 수정",
            content: `
                <form>
                    <div class="form-group">
                        <label>현재 값:</label>
                        <input type="number" name="newValue" value="${current}" min="0" max="${max}">
                        <p class="notes">최대값: ${max}</p>
                    </div>
                </form>
            `,
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: "저장",
                    callback: (html) => {
                        const newValue = Math.min(Math.max(0, 
                            parseInt(html.find('[name="newValue"]').val()) || 0
                        ), max);
                        this.setResource(actorId, resourceType, newValue);
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소"
                }
            },
            default: "save"
        }).render(true);
    }

    static async setResource(actorId, resourceType, newValue) {
        await this.socket.executeForEveryone('updateResource', actorId, resourceType, newValue);
    }

    static _createBlessContent(actors) {
        if (!actors.length) return '<div class="empty-message">표시할 캐릭터가 없습니다.</div>';
 
        return actors.map(actor => {
            const blessItems = actor.items.filter(i => 
                i.system?.props?.type === 'bless'
            );
 
            if (blessItems.length === 0) return '';
 
            return `
                <div class="${this.CSS_PREFIX}-actor-card">
                    <div class="${this.CSS_PREFIX}-actor-header">
                        <img src="${actor.img}" 
                             class="${this.CSS_PREFIX}-actor-image"
                             onclick="ActorStatusManager.openCharacterSheet('${actor.id}')">
                        <div class="${this.CSS_PREFIX}-actor-name">${actor.name}</div>
                    </div>
                    <div class="${this.CSS_PREFIX}-bless-list">
                        ${blessItems.map(item => `
                            <div class="${this.CSS_PREFIX}-bless-item ${item.system.props.use ? 'used' : ''}"
                                 data-actor-id="${actor.id}"
                                 data-item-id="${item.id}">
                                <div class="${this.CSS_PREFIX}-bless-info">
                                    <div class="${this.CSS_PREFIX}-bless-name">${item.name}</div>
                                    <div class="${this.CSS_PREFIX}-bless-details">
                                        ${item.system.props.btiming || ''} | ${item.system.props.btarget || ''}
                                    </div>
                                </div>
                                <div class="${this.CSS_PREFIX}-bless-status">
                                    ${item.system.props.use ? 
                                        '<i class="fas fa-check-circle"></i>' : 
                                        '<i class="far fa-circle"></i>'}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    static _setupStatusEffectListeners() {
        const statusIcons = this.window.querySelectorAll('.status-effect-icon');
        console.log('Setting up status effect listeners:', statusIcons.length);
    
        statusIcons.forEach(icon => {
            icon.addEventListener('click', async (event) => {
                const actorId = event.currentTarget.closest('[data-actor-id]').dataset.actorId;
                const effectId = event.currentTarget.dataset.effectId;
                console.log('Status effect clicked:', { actorId, effectId });
                await StatusEffectManager.toggleEffect(actorId, effectId);
            });
        });
    }
 
    static _setupEventListeners() {
        if (!this.window) return;
        
        console.log('Setting up event listeners');
    
        // 탭 전환
        const tabButtons = this.window.querySelectorAll(`.${this.CSS_PREFIX}-tab-button`);
        console.log('Found tab buttons:', tabButtons.length);
    
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                console.log('Tab button clicked:', button.dataset.tab);
                
                // 모든 탭 버튼에서 active 클래스 제거
                tabButtons.forEach(b => b.classList.remove('active'));
                // 클릭된 탭 버튼에 active 클래스 추가
                button.classList.add('active');
    
                const tabName = button.dataset.tab;
                const contents = this.window.querySelectorAll(`.${this.CSS_PREFIX}-tab-content`);
                
                // 모든 콘텐츠 숨기고 해당하는 탭만 표시
                contents.forEach(c => {
                    const isActive = c.dataset.tab === tabName;
                    c.classList.toggle('active', isActive);
                    
                    // 전투 탭이 활성화되면 CombatInfoManager 이벤트 리스너 설정
                    if (isActive && tabName === 'combat' && CombatInfoManager) {
                        CombatInfoManager.setupEventListeners(this.window);
                    }
                });
            });
        });
    
        // 가호 아이템 리스너
        const blessItems = this.window.querySelectorAll(`.${this.CSS_PREFIX}-bless-item`);
        console.log('Found bless items:', blessItems.length);
        
        blessItems.forEach(item => {
            item.addEventListener('click', async (event) => {
                const actorId = event.currentTarget.dataset.actorId;
                const itemId = event.currentTarget.dataset.itemId;
                if (actorId && itemId) {
                    await this.toggleBless(actorId, itemId);
                }
            });
        });
    
        // 템플릿 관리 리스너
        // 개별 템플릿 제거 버튼
        this.window.querySelectorAll('.remove-template-button').forEach(button => {
            button.addEventListener('click', async (event) => {
                const templateEntry = event.target.closest('.template-entry');
                if (!templateEntry) return;
    
                const weaponId = templateEntry.dataset.weaponId;
                if (weaponId) {
                    await TemplateManager.deleteWeaponTemplates(weaponId);
                    this.updateDisplay();
                }
            });
        });
    
        // 모든 템플릿 제거 버튼
        const clearAllButton = this.window.querySelector('.clear-all-templates-button');
        if (clearAllButton) {
            clearAllButton.addEventListener('click', async () => {
                await TemplateManager.clearAllTemplates();
                this.updateDisplay();
            });
        }
    
        // 현재 활성화된 탭이 전투 탭이면 CombatInfoManager 이벤트 리스너 설정
        const activeTab = this.window.querySelector(`.${this.CSS_PREFIX}-tab-content.active`);
        if (activeTab?.dataset.tab === 'combat' && CombatInfoManager) {
            CombatInfoManager.setupEventListeners(this.window);
        }
    
        // 상태 효과 리스너 설정
        this._setupStatusEffectListeners();
    
        // 템플릿 항목 드래그 앤 드롭 설정 (옵션)
        const templateList = this.window.querySelector('.active-templates-list');
        if (templateList) {
            const templateEntries = templateList.querySelectorAll('.template-entry');
            templateEntries.forEach(entry => {
                entry.setAttribute('draggable', true);
                
                entry.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', entry.dataset.weaponId);
                    entry.classList.add('dragging');
                });
    
                entry.addEventListener('dragend', () => {
                    entry.classList.remove('dragging');
                });
    
                entry.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const dragging = templateList.querySelector('.dragging');
                    if (dragging && dragging !== entry) {
                        const rect = entry.getBoundingClientRect();
                        const halfway = (rect.top + rect.bottom) / 2;
                        if (e.clientY < halfway) {
                            templateList.insertBefore(dragging, entry);
                        } else {
                            templateList.insertBefore(dragging, entry.nextSibling);
                        }
                    }
                });
            });
    
            templateList.addEventListener('drop', (e) => {
                e.preventDefault();
                const dragging = templateList.querySelector('.dragging');
                if (dragging) {
                    dragging.classList.remove('dragging');
                }
            });
        }
    }
 
    static async toggleBless(actorId, itemId) {
        await this.socket.executeAsGM('toggleBless', actorId, itemId);
    }
 
    static async _handleToggleBless(actorId, itemId) {
        console.log('_handleToggleBless called with:', { actorId, itemId });
        
        const actor = game.actors.get(actorId);
        const blessItem = actor?.items.get(itemId);
        
        if (!blessItem) {
            console.error('Bless item not found');
            return;
        }
    
        const isUsed = blessItem.system.props.use || false;
        console.log('Current bless state:', isUsed);
    
        try {
            // 현재 활성화된 탭 저장
            const currentTab = this.window.querySelector(`.${this.CSS_PREFIX}-tab-button.active`)?.dataset.tab;
            console.log('Current active tab before update:', currentTab);
    
            await blessItem.update({
                "system.props.use": !isUsed
            });
    
            // 저장된 탭 정보로 업데이트
            this.updateDisplay(currentTab);
            console.log('Display updated with tab:', currentTab);
    
            if (!isUsed) {
                const content = `
                    <div class="bless-use-message" style="background:#f5f5f5;border-radius:8px;padding:12px">
                        <h3 style="margin:0 0 8px 0">가호 사용</h3>
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                            <img src="${actor.img}" style="width:36px;height:36px;border-radius:50%" />
                            <strong>${actor.name}</strong>
                        </div>
                        <div style="background:white;padding:8px;border-radius:6px;margin-top:8px">
                            <div style="font-weight:bold;color:#4a4a4a">${blessItem.name}</div>
                            <div style="font-size:12px;color:#28a745">
                                <i class="fas fa-clock"></i> ${blessItem.system.props.btiming}
                            </div>
                            <div style="font-size:12px;color:#dc3545">
                                <i class="fas fa-user"></i> ${blessItem.system.props.btarget}
                            </div>
                            <div style="font-size:12px;color:#666;margin-top:4px;padding:4px;background:#f8f9fa;border-radius:4px">
                                <i class="fas fa-star"></i> ${blessItem.system.props.beffect}
                            </div>
                        </div>
                    </div>
                `;
                await ChatMessage.create({
                    content: content,
                    speaker: ChatMessage.getSpeaker({ actor: actor })
                });
            }
        } catch (error) {
            console.error('Error in _handleToggleBless:', error);
            ui.notifications.error("가호 상태 변경 중 오류가 발생했습니다.");
        }
    }
 
    static async adjustResource(actorId, resourceType, amount) {
        const actor = game.actors.get(actorId);
        if (!actor) return;
    
        const current = parseInt(actor.system.props[`${resourceType}value`]) || 0;
        const max = parseInt(actor.system.props[`${resourceType}max`]) || 0;
        
        // 음수 연산 시 current가 0이면 무시
        if (amount < 0 && current === 0) return;
        
        const newValue = Math.min(Math.max(0, current + amount), max);
    
        // 현재값과 같으면 업데이트 하지 않음
        if (newValue === current) return;
    
        await this.socket.executeForEveryone('updateResource', actorId, resourceType, newValue);
    }
 
    static async _handleResourceUpdate(actorId, resourceType, newValue) {
        const actor = game.actors.get(actorId);
        if (!actor || !actor.isOwner) return;
 
        try {
            await actor.update({
                system: {
                    props: {
                        [`${resourceType}value`]: newValue
                    }
                }
            });
        } catch (error) {
            console.error('Error updating resource:', error);
            ui.notifications.error("리소스 업데이트 중 오류가 발생했습니다.");
        }
    }

    static _makeDraggable() {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
 
        const dragStart = (e) => {
            // 버튼이나 입력 필드 클릭 시 드래그 무시
            if (e.target.tagName === 'BUTTON' || 
                e.target.tagName === 'INPUT' || 
                e.target.tagName === 'SELECT' ||
                e.target.closest(`.${this.CSS_PREFIX}-bless-item`)) {
                return;
            }
 
            isDragging = true;
            initialX = e.clientX - this.window.offsetLeft;
            initialY = e.clientY - this.window.offsetTop;
        };
 
        const dragEnd = () => {
            if (!isDragging) return;
            
            isDragging = false;
            
            // 위치 저장
            const rect = this.window.getBoundingClientRect();
            game.settings.set(this.ID, 'actorStatusPosition', {
                top: rect.top,
                right: window.innerWidth - rect.right
            });
        };
 
        const drag = (e) => {
            if (!isDragging) return;
 
            e.preventDefault();
            
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
 
            // 화면 경계 체크
            currentX = Math.max(0, Math.min(currentX, window.innerWidth - this.window.offsetWidth));
            currentY = Math.max(0, Math.min(currentY, window.innerHeight - this.window.offsetHeight));
 
            this.window.style.left = `${currentX}px`;
            this.window.style.top = `${currentY}px`;
        };
 
        this.window.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
    }
 
    static minimize() {
        if (!this.window) return;
 
        if (this.window.classList.contains(`${this.CSS_PREFIX}-minimized`)) {
            this.window.classList.remove(`${this.CSS_PREFIX}-minimized`);
            this.updateDisplay();
        } else {
            this.window.classList.add(`${this.CSS_PREFIX}-minimized`);
            this.window.innerHTML = `
                <div class="${this.CSS_PREFIX}-header">
                    <div class="${this.CSS_PREFIX}-title">캐릭터 상태</div>
                    <div class="${this.CSS_PREFIX}-controls">
                        <button class="${this.CSS_PREFIX}-control-button" onclick="ActorStatusManager.minimize()">
                            <i class="fas fa-expand"></i>
                        </button>
                    </div>
                </div>
            `;
        }
    }
 
    static showConfig() {
        // 플레이어가 소유한 모든 캐릭터와 다른 플레이어가 소유한 캐릭터들을 가져옵니다
        const actors = game.actors.filter(a => {
            // GM은 모든 캐릭터를 볼 수 있음
            if (game.user.isGM) return true;
            
            // 소유 또는 관찰 권한이 있는 캐릭터 필터링
            return Object.entries(a.ownership).some(([userId, level]) => {
                const user = game.users.get(userId);
                return !user?.isGM && level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
            });
        });
    
        const currentSettings = game.settings.get(this.ID, 'actorWidgetSettings') || {};
        const orderSettings = game.settings.get(this.ID, 'actorWidgetOrder') || [];
    
        // 현재 순서에 따라 배열 정렬
        const sortedActors = [...actors].sort((a, b) => {
            const indexA = orderSettings.indexOf(a.id);
            const indexB = orderSettings.indexOf(b.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    
        new Dialog({
            title: "상태창 설정",
            content: `
                <style>
                    .actor-list {
                        max-height: 400px;
                        overflow-y: auto;
                        background: rgba(0, 0, 0, 0.05);
                        padding: 8px;
                        border-radius: 4px;
                    }
                    .actor-item {
                        display: flex;
                        align-items: center;
                        padding: 8px;
                        margin-bottom: 4px;
                        background: white;
                        border-radius: 4px;
                        cursor: grab;
                    }
                    .actor-item.dragging {
                        opacity: 0.5;
                        background: #e9ecef;
                    }
                    .actor-item i {
                        margin-right: 8px;
                        color: #666;
                    }
                    .actor-info {
                        display: flex;
                        align-items: center;
                        flex: 1;
                    }
                    .actor-img {
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        margin-right: 8px;
                    }
                    .actor-name {
                        flex: 1;
                    }
                    .actor-ownership {
                        font-size: 11px;
                        color: #666;
                        margin-left: 8px;
                    }               
                </style>
                <form>
                    <div class="form-group">
                        <label>표시할 캐릭터</label>
                        <div class="actor-list">
                            ${sortedActors.map(actor => `
                                <div class="actor-item" draggable="true" data-actor-id="${actor.id}">
                                    <i class="fas fa-grip-vertical"></i>
                                    <div class="actor-info">
                                        <img class="actor-img" src="${actor.img}">
                                        <span class="actor-name">${actor.name}</span>
                                        <input type="checkbox" 
                                               id="actor-${actor.id}" 
                                               ${currentSettings[actor.id] ? 'checked' : ''}>
                                        <span class="actor-ownership">
                                            ${actor.isOwner ? '(편집 가능)' : '(보기만 가능)'}
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </form>
            `,
            render: (html) => {
                const actorList = html.find('.actor-list')[0];
                let draggedItem = null;
    
                // 드래그 앤 드롭 이벤트 처리
                html.find('.actor-item').each((i, item) => {
                    item.addEventListener('dragstart', (e) => {
                        draggedItem = item;
                        item.classList.add('dragging');
                    });
    
                    item.addEventListener('dragend', () => {
                        item.classList.remove('dragging');
                    });
    
                    item.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        const afterElement = getDragAfterElement(actorList, e.clientY);
                        if (afterElement) {
                            actorList.insertBefore(draggedItem, afterElement);
                        } else {
                            actorList.appendChild(draggedItem);
                        }
                    });
                });
    
                function getDragAfterElement(container, y) {
                    const draggableElements = [...container.querySelectorAll('.actor-item:not(.dragging)')];
                    return draggableElements.reduce((closest, child) => {
                        const box = child.getBoundingClientRect();
                        const offset = y - box.top - box.height / 2;
                        if (offset < 0 && offset > closest.offset) {
                            return { offset: offset, element: child };
                        } else {
                            return closest;
                        }
                    }, { offset: Number.NEGATIVE_INFINITY }).element;
                }
            },
            buttons: {
                save: {
                    icon: '<i class="fas fa-save"></i>',
                    label: "저장",
                    callback: async (html) => {
                        const newSettings = {};
                        const newOrder = [];
                        
                        // 현재 순서대로 액터 ID 저장
                        html.find('.actor-item').each((i, item) => {
                            const actorId = item.dataset.actorId;
                            newOrder.push(actorId);
                            if (html.find(`#actor-${actorId}`).prop('checked')) {
                                newSettings[actorId] = true;
                            }
                        });
    
                        await game.settings.set(this.ID, 'actorWidgetSettings', newSettings);
                        await game.settings.set(this.ID, 'actorWidgetOrder', newOrder);
                        this.updateDisplay();
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소"
                }
            },
            default: "save",
            width: 400
        }).render(true);
    }

    static _createCombatContent(actors) {
        return `
            <div class="combat-templates-section">
                <div class="section-header">
                    <h3>활성 템플릿</h3>
                    <button class="clear-all-templates-button" title="모든 템플릿 제거">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="active-templates-list">
                    ${this._createActiveTemplatesList()}
                </div>
            </div>
            ${this._createCombatActorsContent(actors)}
        `;
    }

    static _createActiveTemplatesList() {
        const activeTemplates = Array.from(TemplateManager.activeTemplates.entries());
        if (!activeTemplates.length) {
            return '<div class="empty-templates-message">활성화된 템플릿이 없습니다</div>';
        }
    
        return activeTemplates.map(([weaponId, templateIds]) => {
            const weapon = Array.from(game.actors.values())
                .flatMap(a => a.items)
                .find(i => i.id === weaponId);
            
            if (!weapon) return '';
    
            const actor = weapon.parent;
            return `
                <div class="template-entry" data-weapon-id="${weaponId}">
                    <div class="template-info">
                        <img src="${actor.img}" class="actor-image" alt="${actor.name}">
                        <div class="template-details">
                            <span class="weapon-name">${weapon.name}</span>
                            <span class="actor-name">${actor.name}</span>
                        </div>
                    </div>
                    <button class="remove-template-button" title="템플릿 제거">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }).join('');
    }
    
    static _createCombatActorsContent(actors) {
        if (!actors.length) return '<div class="empty-message">표시할 캐릭터가 없습니다.</div>';
        
        return actors.map(actor => {
            if (!actor) return '';
    
            return `
                <div class="${this.CSS_PREFIX}-actor-card" data-actor-id="${actor.id}">
                    <div class="${this.CSS_PREFIX}-actor-header">
                        <img src="${actor.img}" 
                             class="${this.CSS_PREFIX}-actor-image"
                             onclick="ActorStatusManager.openCharacterSheet('${actor.id}')">
                        <div class="${this.CSS_PREFIX}-actor-name">${actor.name}</div>
                    </div>
                    ${CombatInfoManager.createCombatInfoHTML(actor)}
                </div>
            `;
        }).join('');
    }
 
    static openCharacterSheet(actorId) {
        const actor = game.actors.get(actorId);
        if (actor) {
            actor.sheet.render(true);
        }
    }
 
    // 추가 스타일
    static {
        const additionalStyles = `
            .${this.CSS_PREFIX}-resource-container {
                margin-bottom: 8px;
            }
 
            .${this.CSS_PREFIX}-resource-label {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
                font-size: 12px;
                color: #ddd;
            }
 
            .${this.CSS_PREFIX}-resource-bar {
                height: 12px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 6px;
                overflow: hidden;
                margin-bottom: 4px;
            }
 
            .${this.CSS_PREFIX}-resource-fill {
                height: 100%;
                transition: width 0.3s ease;
            }
 
            .${this.CSS_PREFIX}-resource-controls {
                display: flex;
                gap: 4px;
            }
 
            .${this.CSS_PREFIX}-resource-controls button {
                flex: 1;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: white;
                padding: 2px 4px;
                font-size: 11px;
                border-radius: 3px;
                cursor: pointer;
                transition: background 0.2s;
            }
 
            .${this.CSS_PREFIX}-resource-controls button:hover {
                background: rgba(255, 255, 255, 0.2);
            }
 
            .${this.CSS_PREFIX}-bless-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
 
            .${this.CSS_PREFIX}-bless-item {
                background: rgba(255, 255, 255, 0.1);
                padding: 8px;
                border-radius: 4px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
                transition: background 0.2s;
            }
 
            .${this.CSS_PREFIX}-bless-item:hover {
                background: rgba(255, 255, 255, 0.2);
            }
 
            .${this.CSS_PREFIX}-bless-item.used {
                background: rgba(100, 100, 100, 0.3);
            }
 
            .${this.CSS_PREFIX}-bless-info {
                flex: 1;
                min-width: 0;
            }
 
            .${this.CSS_PREFIX}-bless-name {
                font-weight: bold;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
 
            .${this.CSS_PREFIX}-bless-details {
                font-size: 11px;
                color: #aaa;
            }
 
            .${this.CSS_PREFIX}-minimized {
                width: auto !important;
                min-width: 200px !important;
                max-width: 200px !important;           
            }
 
            .${this.CSS_PREFIX}-minimized .${this.CSS_PREFIX}-content,
            .${this.CSS_PREFIX}-minimized .${this.CSS_PREFIX}-tabs {
                display: none !important;
            }

            .${this.CSS_PREFIX}-minimized .${this.CSS_PREFIX}-header {
                margin-bottom: 0;
                padding-bottom: 0;
                border-bottom: none;
            }

            .${this.CSS_PREFIX}-linked-info {
                margin-top: 8px;
                padding-top: 8px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
                font-size: 11px;
                color: #aaa;
            }

            .${this.CSS_PREFIX}-guardian,
            .${this.CSS_PREFIX}-linkage {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 4px 0;
            }

            .${this.CSS_PREFIX}-resource-value {
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 3px;
                transition: background-color 0.2s;
            }

            .${this.CSS_PREFIX}-resource-value:hover {
                background: rgba(255, 255, 255, 0.1);
            }
 
            .warning {
                animation: warning-pulse 2s infinite;
            }
 
            @keyframes warning-pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
        .combat-templates-section {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 16px;
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .section-header h3 {
            font-size: 14px;
            color: #ddd;
            margin: 0;
        }

        .clear-all-templates-button {
            background: rgba(220, 53, 69, 0.3);
            border: none;
            color: #fff;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
        }

        .clear-all-templates-button:hover {
            background: rgba(220, 53, 69, 0.5);
        }

        .template-entry {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 8px;
        }

        .template-info {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .template-info .actor-image {
            width: 24px;
            height: 24px;
            border-radius: 50%;
        }

        .template-details {
            display: flex;
            flex-direction: column;
        }

        .weapon-name {
            font-weight: bold;
            color: #fff;
        }

        .actor-name {
            font-size: 11px;
        }

        .remove-template-button {
            background: none;
            border: none;
            color: #aaa;
            cursor: pointer;
            padding: 4px;
        }

        .remove-template-button:hover {
            color: #fff;
        }

        .empty-templates-message {
            text-align: center;
            color: #aaa;
            padding: 12px;
            font-style: italic;
        }         

        .template-entry.dragging {
            opacity: 0.5;
            background: rgba(255, 255, 255, 0.2);
        }

        .active-templates-list {
            min-height: 50px;
            padding: 4px;
        }

        .template-entry {
            cursor: grab;
        }

        .template-entry:active {
            cursor: grabbing;
        }             
        `;
 
        const existingStyle = document.createElement('style');
        existingStyle.textContent = additionalStyles;
        document.head.appendChild(existingStyle);
    }
 }