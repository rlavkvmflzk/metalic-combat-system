import { TemplateManager } from './TemplateManager.js';

class CombatInfoManager {
    static ID = 'metalic-combat-system';
    static socket = null;

    static ATTACK_TYPE_LABELS = {
        'hit': '명중',
        'shelling': '포격',
        'evasion': '회피',
        'pro': '방벽',
        'init': '행동'
    };

    static initialize(socketlib) {
        if (!socketlib) {
            console.error('[CombatInfoManager] No socketlib provided');
            return false;
        }
    
        try {
            this.socket = socketlib;
            this._registerSocketHandlers();
            this._registerHooks(); // 후크 등록 추가
            this.injectStyles();
            console.log('[CombatInfoManager] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[CombatInfoManager] Initialization error:', error);
            return false;
        }
    }

    static _registerSocketHandlers() {
        if (!this.socket) {
            console.error('[CombatInfoManager] Cannot register handlers: No socket');
            return;
        }

        try {
            this.socket.register('performQuickAttack', this._handleQuickAttack.bind(this));
            this.socket.register('adjustAmmo', this._handleAdjustAmmo.bind(this));
            this.socket.register('performQuickRoll', this._handleQuickRoll.bind(this));
            console.log('[CombatInfoManager] Socket handlers registered');
        } catch (error) {
            console.error('[CombatInfoManager] Error registering socket handlers:', error);
        }
    }

    static createCombatInfoHTML(actors) {
        console.log('Creating combat info HTML for actors:', actors);
    
        if (!Array.isArray(actors)) {
            console.warn('[CombatInfoManager] No valid actors provided');
            return '';
        }
    
        return actors.map(actor => {
            console.log('Processing actor:', actor?.name, actor);
            
            if (!actor?.system?.props) {
                console.warn(`[CombatInfoManager] Invalid actor data for: ${actor?.name || 'Unknown'}`);
                return '';
            }
    
            const actorHtml = `
                <div class="combat-info-section" data-actor-id="${actor.id}">
                    <div class="combat-actor-card">
                        <div class="combat-actor-header">
                            <img src="${actor.img}" class="combat-actor-image" alt="${actor.name}">
                            <span class="combat-actor-name">${actor.name}</span>
                        </div>
                        ${this._createCombatStatsHTML(actor)}
                        ${this._createWeaponSectionHTML(actor)}
                    </div>
                </div>
            `;
            
            return actorHtml;
        }).join('');
    }
    

    static _createCombatStatsHTML(actor) {
        console.log('Creating combat stats for:', actor.name);
        
        try {
            const stats = {
                hit: actor.system.props.hit || 0,
                evasion: actor.system.props.evasion || 0,
                pro: actor.system.props.pro || 0,
                init: actor.system.props.init || 0,
                shelling: actor.system.props.shelling || 0
            };
    
            console.log('Actor stats:', stats);
    
            const gridItems = Object.entries(this.ATTACK_TYPE_LABELS).map(([type, label]) => `
                <div class="combat-stat-item" data-stat-type="${type}">
                    <div class="stat-header">
                        <span class="stat-label">${label}</span>
                        <span class="stat-value">${stats[type]}</span>
                    </div>
                    <button class="quick-roll-button" title="${label} 판정">
                        <i class="fas fa-dice-d20"></i> 판정
                    </button>
                </div>
            `).join('');
    
            return `
                <div class="combat-stats-container">
                    <div class="section-title">
                        <i class="fas fa-dice"></i> 전투 능력치
                    </div>
                    <div class="combat-stats-grid">
                        ${gridItems}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error(`Error creating combat stats for ${actor.name}:`, error);
            return '';
        }
    }

    static _createWeaponSectionHTML(actor) {
        console.log('Creating weapon section for:', actor.name);
        
        try {
            // isEquipped가 true인 무기만 필터링
            const weapons = actor.items.filter(i => 
                i.system?.props?.type === 'weapon' && 
                i.system?.props?.isEquipped === true  
            );
            console.log('Found equipped weapons:', weapons);
    
            if (!weapons.length) {
                return `
                    <div class="weapon-section empty">
                        <div class="section-title">
                            <i class="fas fa-sword"></i> 장비된 무장
                        </div>
                        <div class="empty-message">장비된 무장이 없습니다</div>
                    </div>
                `;
            }
    
            const weaponsHtml = weapons.map(weapon => {
                const props = weapon.system.props;
                console.log('Processing weapon:', weapon.name, props);
                
                return this._createWeaponItemHTML(weapon, actor);
            }).join('');
    
            return `
                <div class="weapon-section">
                    <div class="section-title">
                        <i class="fas fa-sword"></i> 장비된 무장
                    </div>
                    <div class="weapon-list">
                        ${weaponsHtml}
                    </div>
                </div>
            `;
        } catch (error) {
            console.error(`Error creating weapon section for ${actor.name}:`, error);
            return '';
        }
    }

    static _createWeaponItemHTML(weapon, actor) {
        const props = weapon.system.props;
        const usesBullets = props.weaponcost?.includes('탄수');
        const hasBullets = props.bullets !== undefined;
        const hasCost = props.weaponcost && props.weaponcost !== '0';
        
        // 부위에 따라 대미지 값 선택
        const isPart = props.part?.toLowerCase();
        const isSubWeapon = isPart?.includes('부무장');
        const displayDamage = isSubWeapon ? props.sidedamage : props.weaponfinaldmg;
    
        return `
            <div class="weapon-item" data-weapon-id="${weapon.id}" data-actor-id="${actor.id}">
                <div class="weapon-main">
                    <div class="weapon-header">
                        <div class="weapon-title">
                            <span class="weapon-name">${weapon.name}</span>
                            ${this._createWeaponTagsHTML(props)}
                        </div>
                        ${usesBullets && hasBullets ? `
                            <div class="ammo-display ${parseInt(props.bullets) <= 0 ? 'empty' : ''}">
                                <i class="fas fa-circle"></i>
                                <span>${props.bullets || 0}</span>
                            </div>
                        ` : ''}
                    </div>
                    <div class="weapon-info">
                        <div class="weapon-stats">
                            <span class="weapon-type">${props.weapontype || ''}</span>
                            <span class="weapon-range">${props.weaponrange || ''}</span>
                            ${props.weapontarget ? `<span class="weapon-target">${props.weapontarget}</span>` : ''}
                            ${displayDamage ? `
                                <span class="weapon-damage">
                                    <i class="fas fa-heart-broken"></i>
                                    ${displayDamage}
                                </span>
                            ` : ''}
                        </div>
                        ${hasCost ? `
                            <div class="weapon-cost">
                                <i class="fas fa-coins"></i>
                                <span>${props.weaponcost}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
    
                <div class="weapon-details collapsible">
                    <div class="weapon-stats-detail">
                        ${displayDamage ? `
                            <div class="stat-item">
                                <span class="stat-label">대미지</span>
                                <span class="stat-value">${displayDamage}</span>
                            </div>
                        ` : ''}
                        ${props.weaponcrit ? `
                            <div class="stat-item">
                                <span class="stat-label">크리티컬</span>
                                <span class="stat-value">${props.weaponcrit}</span>
                            </div>
                        ` : ''}
                        ${props.atk ? `
                            <div class="stat-item">
                                <span class="stat-label">공격력</span>
                                <span class="stat-value">${props.atk}</span>
                            </div>
                        ` : ''}
                    </div>
                    ${props.weaponeffect ? `
                        <div class="weapon-effect">
                            <div class="effect-label">효과</div>
                            <div class="effect-text">${props.weaponeffect}</div>
                        </div>
                    ` : ''}
                </div>
    
                <div class="weapon-controls">
                    ${usesBullets && hasBullets ? `
                        <div class="ammo-controls">
                            <div class="ammo-buttons">
                                <button class="ammo-adjust" data-amount="-1">
                                    <i class="fas fa-minus"></i>
                                </button>
                                <button class="ammo-adjust" data-amount="1">
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>
                        </div>
                    ` : ''}
                    <div class="action-buttons">
                        <button class="template-toggle-button" title="템플릿 표시">
                            <i class="fas fa-bullseye"></i>
                        </button>
                        <button class="quick-attack-button" data-weapon-id="${weapon.id}">
                            <i class="fas fa-crosshairs"></i>
                            공격
                        </button>
                    </div>
                </div>
            </div>`;
    }
 
    static _createWeaponTagsHTML(props) {
        const tags = [];
 
        if (props.sniping) {
            tags.push({
                icon: 'fa-bullseye',
                label: '저격',
                class: 'sniper'
            });
        }
        if (props.armorignore) {
            tags.push({
                icon: 'fa-shield-alt',
                label: '방어관통',
                class: 'penetrate'
            });
        }
        if (props.PK) {
            tags.push({
                icon: 'fa-brain',
                label: '염동',
                class: 'psychic'
            });
        }
        if (props.jump) {
            tags.push({
                icon: 'fa-running',
                label: '도약',
                class: 'jump'
            });
        }
        if (props.transition) {
            tags.push({
                icon: 'fa-exchange-alt',
                label: '전이',
                class: 'transition'
            });
        }
        if (props.awakening) {
            tags.push({
                icon: 'fa-lightbulb',
                label: '각성',
                class: 'awakening'
            });
        }
 
        if (!tags.length) return '';
 
        return `
            <div class="weapon-tags">
                ${tags.map(tag => `
                    <span class="weapon-tag ${tag.class}" title="${tag.label}">
                        <i class="fas ${tag.icon}"></i>
                    </span>
                `).join('')}
            </div>
        `;
    }
 
    static async performQuickAttack(actorId, weaponId) {
        const actor = game.actors.get(actorId);
        const weapon = actor?.items.get(weaponId);
        
        if (!actor || !weapon) {
            ui.notifications.error("무장이나 액터를 찾을 수 없습니다.");
            return;
        }
    
        const targets = game.user.targets;
        if (targets.size === 0) {
            ui.notifications.warn("대상을 선택해주세요.");
            return;
        }
    
        try {
            const weaponData = {
                name: weapon.name,
                weaponcrit: weapon.system.props.weaponcrit || "0",
                weapontype: weapon.system.props.weapontype || "",
                weaponrange: weapon.system.props.weaponrange || "",
                weaponcost: weapon.system.props.weaponcost || "",
                weaponfinaldmg: weapon.system.props.weaponfinaldmg || "0",
                sidedamage: weapon.system.props.sidedamage || "0",
                weaponeffect: weapon.system.props.weaponeffect || "",
                weapontarget: weapon.system.props.weapontarget || "",
                weaponfx: weapon.system.props.weaponfx || "",
                part: weapon.system.props.part || "근접",
                weaponkind: weapon.system.props.weaponkind || "",
                atk: actor.system.props.atk || "0",
                sniping: weapon.system.props.sniping || false,
                armorignore: weapon.system.props.armorignore || false,
                dmgdiebonus: actor.system.props.dmgdiebonus || "0",
                dmgnumbonus: actor.system.props.dmgnumbonus || "0"
            };
    
            // 1. 특기 선택 다이얼로그
            const selectedSpecialties = await this._showAttackSpecialtyDialog(actor);
            if (selectedSpecialties === null) return;
    
            // 2. 특기 대가 처리
            if (selectedSpecialties?.length) {
                const totalCost = window.MetalicCombatSystem.CombatManager._calculateEffectsCost(selectedSpecialties);
                if (!await window.MetalicCombatSystem.CombatManager._handleEffectsCost(totalCost, actor, selectedSpecialties)) {
                    return;
                }
                await window.MetalicCombatSystem.CombatManager._activateEffects(actor, selectedSpecialties);
            }
    
            // 3. 무기 비용 처리
            if (weaponData.weaponcost) {
                const costConfirmed = await this._handleWeaponCost(actor, weaponData.weaponcost, weapon);
                if (!costConfirmed) return;
            }

            const defaultAttackType = this._determineAttackType(weaponData.part);
    
            // 4. 명중 판정 다이얼로그
            const attackTypeDialog = await new Promise((resolve) => {
                new Dialog({
                    title: "명중 판정",
                    content: `
                        <style>
                            .attack-dialog {
                                background: #f5f5f5;
                                padding: 15px;
                                border-radius: 8px;
                            }
                            .attack-dialog .form-group {
                                background: white;
                                padding: 12px;
                                border-radius: 6px;
                                box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                                margin-bottom: 15px;
                            }
                            .attack-dialog .form-group label {
                                display: block;
                                margin-bottom: 8px;
                                color: #4a4a4a;
                                font-weight: bold;
                            }
                            .attack-dialog .form-group select,
                            .attack-dialog .form-group input {
                                width: 100%;
                                padding: 8px;
                                border: 1px solid #ddd;
                                border-radius: 4px;
                                background: white;
                                height: 38px;
                                font-size: 14px;
                            }
                            .attack-dialog .form-group select:focus,
                            .attack-dialog .form-group input:focus {
                                border-color: #4a4a4a;
                                box-shadow: 0 0 0 2px rgba(74,74,74,0.2);
                                outline: none;
                            }
                        </style>
                        <div class="attack-dialog">
                            <div class="form-group">
                                <label>판정 능력치:</label>
                                <select name="attackType">
                                    <option value="hit" ${defaultAttackType === 'hit' ? 'selected' : ''}>명중</option>
                                    <option value="shelling" ${defaultAttackType === 'shelling' ? 'selected' : ''}>포격</option>
                                    <option value="evasion">회피</option>
                                    <option value="pro">방벽</option>
                                    <option value="init">행동</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>수정치:</label>
                                <input type="number" name="modifier" value="0">
                            </div>
                        </div>
                    `,
                    buttons: {
                        roll: {
                            icon: '<i class="fas fa-dice"></i>',
                            label: "공격",
                            callback: (html) => {
                                resolve({
                                    attackType: html.find('[name="attackType"]').val(),
                                    modifier: parseInt(html.find('[name="modifier"]').val()) || 0
                                });
                            }
                        },
                        cancel: {
                            icon: '<i class="fas fa-times"></i>',
                            label: "취소",
                            callback: () => resolve(null)
                        }
                    },
                    default: "roll"
                }).render(true);
            });
    
            if (!attackTypeDialog) return;
    
            // 5. 공격 실행
            const attackerIds = [actor.id];
            const targetIds = Array.from(targets).map(t => t.id);
    
            await window.MetalicCombatSystem.CombatManager.performMultiAttack(
                attackerIds,
                targetIds,
                attackTypeDialog.attackType,
                attackTypeDialog.modifier,
                weaponData.weaponcrit,
                actor.system.props.atkcritmod || '0',
                weaponData.part,
                weaponData,
                selectedSpecialties
            );
    
        } catch (error) {
            console.error("Error performing quick attack:", error);
            ui.notifications.error("공격 실행 중 오류가 발생했습니다.");
        }
    }
 
    static async _showAttackSpecialtyDialog(actor) {
        const selections = actor.items
        .filter(item =>
            (item.system?.props?.type === "specialty" &&
             (item.system?.props?.sselect === "공격시" || item.system?.props?.sselect === "공방시")) ||
            (item.system?.props?.type === "item" &&
             (item.system?.props?.iselect === "공격시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "weapon" && 
             (item.system?.props?.iselect === "공격시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "option" && 
             (item.system?.props?.iselect === "공격시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "bless" && 
             !item.system?.props?.use && 
             (item.system?.props?.iselect === "공격시" || item.system?.props?.iselect === "공방시"))
        )
        .map(item => {
            if (item.system.props.type === "specialty") {
                return {
                    id: item.id,
                    name: item.name,
                    type: 'specialty',
                    cost: item.system.props.scost,
                    level: item.system.props.slv,
                    target: item.system.props.starget,
                    range: item.system.props.srange,
                    timing: item.system.props.stiming,
                    effect: item.system.props.seffect,
                    modifiers: item.system.modifiers || [],
                    limit: item.system.props.limit,
                    item: item
                };
            } else if (item.system.props.type === "weapon") {
                return {
                    id: item.id,
                    name: item.name,
                    type: 'weapon',
                    timing: '공격시',
                    target: item.system.props.weapontarget,
                    effect: item.system.props.weaponeffect,
                    item: item
                };
            } else if (item.system.props.type === "option") {
                return {
                    id: item.id,
                    name: item.name,
                    type: 'option',
                    cost: item.system.props.optioncost,
                    timing: '공격시',
                    effect: item.system.props.optioneffect,
                    item: item
                };
            } else if (item.system.props.type === "bless") {
                return {
                    id: item.id,
                    name: item.name,
                    type: 'bless',
                    timing: item.system.props.btiming,
                    target: item.system.props.btarget,
                    effect: item.system.props.beffect,
                    item: item,
                    use: item.system.props.use || false
                };
            } else {
                return {
                    id: item.id,
                    name: item.name,
                    type: 'item',
                    cost: item.system.props.icost,
                    timing: item.system.props.itiming, 
                    effect: item.system.props.ieffect,
                    item: item
                };
            }
        });
    
        if (!selections.length) return [];
    
        return new Promise((resolve) => {
            new SpecialtySelectionDialog({    
                title: "특기/아이템 선택",
                content: this._createSpecialtyDialogContent(selections),
                buttons: {
                    apply: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "적용",
                        callback: (html) => {
                            const selectedIds = Array.from(html.find('input[name="selectedEffects"]:checked'))
                                .map(input => ({ id: input.value, type: input.dataset.type }));
                            resolve(selections.filter(s => selectedIds.some(sel => sel.id === s.id)));
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "취소",
                        callback: () => resolve([])
                    }
                },
                default: "apply",
                width: 800,
                popOut: true,
                resizable: true
            }).render(true);
        });
    }
 
    static _createSpecialtyDialogContent(selections) {
        // 선택지들을 카테고리별로 분류
        const categorized = {
            specialty: selections.filter(s => s.type === 'specialty'),
            weapon: selections.filter(s => s.type === 'weapon'),
            item: selections.filter(s => s.type === 'item'),
            option: selections.filter(s => s.type === 'option'),
            bless: selections.filter(s => s.type === 'bless')
        };
    
        // 타입별 스타일 함수
        const getTypeStyle = (type) => {
            switch(type) {
                case 'specialty':
                    return 'background: rgba(44, 123, 229, 0.1); color: #2c7be5;';
                case 'weapon':
                    return 'background: rgba(220, 53, 69, 0.1); color: #dc3545;';
                case 'option':
                    return 'background: rgba(111, 66, 193, 0.1); color: #6f42c1;';
                case 'bless':
                    return 'background: rgba(255, 193, 7, 0.1); color: #ffc107;';
                default: // item
                    return 'background: rgba(40, 167, 69, 0.1); color: #28a745;';
            }
        };
    
        // 효과 옵션 생성 함수
        const createEffectOptions = (items) => {
            return items.map(selection => `
                <div class="effect-option">
                    <div class="checkbox-wrapper">
                        <input type="checkbox" 
                               id="effect-${selection.id}" 
                               name="selectedEffects" 
                               value="${selection.id}"
                               data-type="${selection.type}">
                        <div class="effect-details">
                            <div class="specialty-header">
                                <div class="specialty-title">
                                    <span class="effect-name">
                                        ${selection.name?.replace('$', '')}
                                    </span>
                                    <span class="type-badge" style="${getTypeStyle(selection.type)}">
                                        ${selection.type === 'specialty' ? '특기' : 
                                        selection.type === 'weapon' ? '무장' : 
                                        selection.type === 'option' ? '옵션' : 
                                        selection.type === 'bless' ? '가호' :
                                        '아이템'}
                                    </span>
                                    ${selection.type === 'specialty' && selection.level ? `
                                        <span class="level-badge">LV.${selection.level?.replace('$', '')}</span>
                                    ` : ''}
                                    ${selection.type === 'specialty' && selection.item?.system?.props?.maxlimit > 0 && selection.limit !== undefined ? `
                                        <span class="limit-badge" style="
                                            background: ${selection.limit <= 0 ? '#dc3545' : '#28a745'}1a;
                                            color: ${selection.limit <= 0 ? '#dc3545' : '#28a745'};">
                                            <i class="fas fa-redo"></i> ${selection.limit}/${selection.item.system.props.maxlimit}회
                                        </span>
                                    ` : ''}
                                </div>
                            </div>
    
                            ${selection.type === 'specialty' ? `
                                <div class="tags-container">
                                    ${selection.timing ? `
                                        <span class="tag timing-tag">
                                            <i class="fas fa-clock"></i> ${selection.timing?.replace('$', '')}
                                        </span>
                                    ` : ''}
                                    ${selection.target ? `
                                        <span class="tag target-tag">
                                            <i class="fas fa-bullseye"></i> ${selection.target?.replace('$', '')}
                                        </span>
                                    ` : ''}
                                    ${selection.range ? `
                                        <span class="tag range-tag">
                                            <i class="fas fa-ruler"></i> ${selection.range?.replace('$', '')}
                                        </span>
                                    ` : ''}
                                    ${selection.cost ? `
                                        <span class="tag cost-tag">
                                            <i class="fas fa-coins"></i> ${selection.cost?.replace('$', '')}
                                        </span>
                                    ` : ''}
                                </div>
                            ` : `
                                <div class="tags-container">
                                    ${selection.timing ? `
                                        <span class="tag timing-tag">
                                            <i class="fas fa-clock"></i> ${selection.timing?.replace('$', '')}
                                        </span>
                                    ` : ''}
                                    ${selection.cost ? `
                                        <span class="tag cost-tag">
                                            <i class="fas fa-coins"></i> ${selection.cost?.replace('$', '')}
                                        </span>
                                    ` : ''}
                                </div>
                            `}
    
                            ${selection.effect ? `
                                <div class="effect-description">
                                    <i class="fas fa-star"></i> ${selection.effect?.replace('$', '')}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');
        };
    
        return `
            <style>
                .specialty-selection-dialog {
                    min-width: 800px !important;
                    min-height: 600px !important;
                }

                .specialty-selection-dialog .window-content {
                    width: 100% !important;
                    height: 100% !important;
                    padding: 8px;
                }

                .specialty-selection-dialog .dialog-content {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                }

                .specialty-selection-dialog .effect-selection {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 8px;
                    flex: 1;
                    overflow-y: auto;
                }

                .specialty-selection-dialog .specialty-tabs {
                    display: flex;
                    gap: 4px;
                    margin-bottom: 15px;
                    background: #f0f0f0;
                    padding: 8px;
                    border-radius: 8px;
                    flex-shrink: 0;
                }

                .specialty-selection-dialog .specialty-tab {
                    padding: 8px 16px;
                    background: rgba(255, 255, 255, 0.5);
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #666;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .specialty-selection-dialog .specialty-tab.active {
                    background: white;
                    color: #4a4a4a;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }

                .specialty-selection-dialog .specialty-count {
                    background: rgba(0,0,0,0.1);
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                }

                .specialty-selection-dialog .specialty-tab-content {
                    display: none;
                }

                .specialty-selection-dialog .specialty-tab-content.active {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                }

                .specialty-selection-dialog .effect-option {
                    width: 100%;
                    background: white;
                    padding: 12px;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                    transition: all 0.2s ease;
                    margin-bottom: 8px;
                }

                .specialty-selection-dialog .effect-option:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                }

                .specialty-selection-dialog .checkbox-wrapper {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    width: 100%;
                }

                .specialty-selection-dialog .checkbox-wrapper input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    margin-top: 2px;
                    cursor: pointer;
                }

                .specialty-selection-dialog .effect-details {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .specialty-selection-dialog .specialty-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .specialty-selection-dialog .specialty-title {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .specialty-selection-dialog .effect-name {
                    font-weight: bold;
                    color: #4a4a4a;
                    font-size: 14px;
                }

                .specialty-selection-dialog .level-badge {
                    background: #e9ecef;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #4a4a4a;
                    white-space: nowrap;
                }

                .specialty-selection-dialog .tags-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .specialty-selection-dialog .tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    white-space: nowrap;
                }

                .specialty-selection-dialog .timing-tag {
                    background: #28a7451a;
                    color: #28a745;
                }

                .specialty-selection-dialog .target-tag {
                    background: #dc35451a;
                    color: #dc3545;
                }

                .specialty-selection-dialog .range-tag {
                    background: #6c757d1a;
                    color: #6c757d;
                }

                .specialty-selection-dialog .cost-tag {
                    background: #007bff1a;
                    color: #007bff;
                }

                .specialty-selection-dialog .effect-description {
                    font-size: 13px;
                    color: #666;
                    line-height: 1.4;
                    padding: 8px;
                    background: #f8f9fa;
                    border-radius: 6px;
                }

                .specialty-selection-dialog .type-badge {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                }

                .specialty-selection-dialog .empty-tab-message {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 20px;
                    color: #666;
                    background: rgba(255, 255, 255, 0.5);
                    border-radius: 6px;
                }

                .specialty-selection-dialog .dialog-buttons {
                    display: flex !important;
                    flex-direction: row !important;
                    justify-content: flex-end !important;
                    gap: 8px !important;
                    height: 36px !important;
                    min-height: 36px !important;
                    max-height: 36px !important;
                    padding: 0 !important;
                    margin-top: 8px !important;
                    flex-shrink: 0;
                }

                .specialty-selection-dialog .dialog-button {
                    height: 36px !important;
                    min-height: 36px !important;
                    max-height: 36px !important;
                    line-height: 36px !important;
                    box-sizing: border-box !important;
                    padding: 0 16px !important;
                    margin: 0 !important;
                    min-width: 80px !important;
                }
            </style>
    
            <div class="specialty-tabs">
                ${categorized.specialty.length > 0 ? `
                    <button class="specialty-tab active" data-tab="specialty">
                        <i class="fas fa-star"></i> 특기
                        <span class="specialty-count">${categorized.specialty.length}</span>
                    </button>
                ` : ''}
                ${categorized.weapon.length > 0 ? `
                    <button class="specialty-tab" data-tab="weapon">
                        <i class="fas fa-sword"></i> 무장
                        <span class="specialty-count">${categorized.weapon.length}</span>
                    </button>
                ` : ''}
                ${categorized.item.length > 0 ? `
                    <button class="specialty-tab" data-tab="item">
                        <i class="fas fa-box"></i> 아이템
                        <span class="specialty-count">${categorized.item.length}</span>
                    </button>
                ` : ''}
                ${categorized.option.length > 0 ? `
                    <button class="specialty-tab" data-tab="option">
                        <i class="fas fa-cog"></i> 옵션
                        <span class="specialty-count">${categorized.option.length}</span>
                    </button>
                ` : ''}
                ${categorized.bless.length > 0 ? `
                    <button class="specialty-tab" data-tab="bless">
                        <i class="fas fa-crown"></i> 가호
                        <span class="specialty-count">${categorized.bless.length}</span>
                    </button>
                ` : ''}
            </div>
    
            <div class="effect-selection">
                <div class="specialty-tab-content active" data-tab="specialty">
                    ${categorized.specialty.length > 0 ? 
                        createEffectOptions(categorized.specialty) : 
                        '<div class="empty-tab-message">사용 가능한 특기가 없습니다</div>'}
                </div>
                
                <div class="specialty-tab-content" data-tab="weapon">
                    ${categorized.weapon.length > 0 ? 
                        createEffectOptions(categorized.weapon) : 
                        '<div class="empty-tab-message">사용 가능한 무장이 없습니다</div>'}
                </div>
                
                <div class="specialty-tab-content" data-tab="item">
                    ${categorized.item.length > 0 ? 
                        createEffectOptions(categorized.item) : 
                        '<div class="empty-tab-message">사용 가능한 아이템이 없습니다</div>'}
                </div>
                
                <div class="specialty-tab-content" data-tab="option">
                    ${categorized.option.length > 0 ? 
                        createEffectOptions(categorized.option) : 
                        '<div class="empty-tab-message">사용 가능한 옵션이 없습니다</div>'}
                </div>
                
                <div class="specialty-tab-content" data-tab="bless">
                    ${categorized.bless.length > 0 ? 
                        createEffectOptions(categorized.bless) : 
                        '<div class="empty-tab-message">사용 가능한 가호가 없습니다</div>'}
                </div>
            </div>
    
            <script>
                (function() {
                    document.querySelectorAll('.specialty-tab').forEach(function(tab) {
                        tab.addEventListener('click', function(e) {
                            document.querySelectorAll('.specialty-tab').forEach(function(t) {
                                t.classList.remove('active');
                            });
                            document.querySelectorAll('.specialty-tab-content').forEach(function(c) {
                                c.classList.remove('active');
                            });
                            
                            tab.classList.add('active');
                            var tabName = tab.dataset.tab;
                            document.querySelector('.specialty-tab-content[data-tab="' + tabName + '"]')
                                .classList.add('active');
                        });
                    });
                })();
            </script>
        `;
    }
 
    static async _handleWeaponCost(actor, costString, weapon) {
        const costs = this._parseCosts(costString);
        
        return new Promise((resolve) => {
            new Dialog({
                title: "무장 사용 비용",
                content: this._createCostDialogContent(costs),
                buttons: {
                    confirm: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "확인",
                        callback: async (html) => {
                            const shouldConsume = html.find('[name="consumeCost"]').is(":checked");
                            if (shouldConsume) {
                                try {
                                    await this._processCosts(actor, costs, weapon);
                                    resolve(true);
                                } catch (error) {
                                    console.error("Error processing costs:", error);
                                    ui.notifications.error("비용 처리 중 오류가 발생했습니다.");
                                    resolve(false);
                                }
                            } else {
                                resolve(true);
                            }
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "취소",
                        callback: () => resolve(false)
                    }
                },
                default: "confirm"
            }).render(true);
        });
    }
 
    static _parseCosts(costString) {
        const costs = {
            fp: 0,
            hp: 0,
            en: 0,
            bullets: 0,
            effects: []
        };
 
        const costStr = costString.toLowerCase().replace(/\s+/g, '');
        const matches = [...costStr.matchAll(/(\d+)?(fp|hp|en|탄수)(\d+)?/g)];
 
        matches.forEach(match => {
            const type = match[2];
            const value = parseInt(match[1] || match[3] || 0);
 
            switch(type) {
                case 'fp': costs.fp += value; break;
                case 'hp': costs.hp += value; break;
                case 'en': costs.en += value; break;
                case '탄수': costs.bullets += value; break;
            }
        });
 
        // 효과 추출
        let remainingText = costStr;
        matches.forEach(match => {
            remainingText = remainingText.replace(match[0], ',');
        });
 
        costs.effects = remainingText
        .split(',')
        .map(effect => effect.trim())
        .filter(effect => effect !== '' && effect !== '없음');

    return costs;
}

static _createCostDialogContent(costs) {
    const costItems = [];

    if (costs.fp > 0) {
        costItems.push(`
            <div class="cost-item fp">
                <span class="cost-label">FP</span>
                <span class="cost-value">${costs.fp}</span>
            </div>
        `);
    }
    if (costs.hp > 0) {
        costItems.push(`
            <div class="cost-item hp">
                <span class="cost-label">HP</span>
                <span class="cost-value">${costs.hp}</span>
            </div>
        `);
    }
    if (costs.en > 0) {
        costItems.push(`
            <div class="cost-item en">
                <span class="cost-label">EN</span>
                <span class="cost-value">${costs.en}</span>
            </div>
        `);
    }
    if (costs.bullets > 0) {
        costItems.push(`
            <div class="cost-item bullets">
                <span class="cost-label">탄약</span>
                <span class="cost-value">${costs.bullets}</span>
            </div>
        `);
    }
    if (costs.effects.length > 0) {
        costItems.push(`
            <div class="cost-item effects">
                <span class="cost-label">효과</span>
                <span class="cost-value">${costs.effects.join(', ')}</span>
            </div>
        `);
    }

    return `
        <style>
            .cost-dialog {
                background: #f5f5f5;
                padding: 15px;
                border-radius: 8px;
            }
            .cost-list {
                background: white;
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 12px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .cost-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 0;
                border-bottom: 1px solid #eee;
            }
            .cost-item:last-child {
                border-bottom: none;
            }
            .cost-label {
                font-weight: bold;
                color: #4a4a4a;
            }
            .cost-value {
                color: #666;
            }
            .cost-item.fp .cost-label { color: #2c7be5; }
            .cost-item.hp .cost-label { color: #dc3545; }
            .cost-item.en .cost-label { color: #6c757d; }
            .cost-item.bullets .cost-label { color: #ffc107; }
            .cost-item.effects .cost-label { color: #28a745; }
            .cost-checkbox {
                margin-top: 10px;
                padding: 8px;
                background: white;
                border-radius: 6px;
            }
        </style>
        <div class="cost-dialog">
            <div class="cost-list">
                ${costItems.join('')}
            </div>
            <div class="cost-checkbox">
                <label>
                    <input type="checkbox" name="consumeCost" checked>
                    비용 소비하기
                </label>
            </div>
        </div>
    `;
}

static async _processCosts(actor, costs, weapon) {
    if (costs.fp > 0) {
        const currentFP = actor.system.props.fpvalue || 0;
        await actor.update({
            "system.props.fpvalue": Math.max(0, currentFP - costs.fp)
        });
    }

    if (costs.hp > 0) {
        const currentHP = actor.system.props.hpvalue || 0;
        await actor.update({
            "system.props.hpvalue": Math.max(0, currentHP - costs.hp)
        });
    }

    if (costs.en > 0) {
        const currentEN = actor.system.props.envalue || 0;
        await actor.update({
            "system.props.envalue": Math.max(0, currentEN - costs.en)
        });
    }

    if (costs.bullets > 0 && weapon) {
        const currentBullets = weapon.system.props.bullets || 0;
        if (currentBullets < costs.bullets) {
            throw new Error("탄약이 부족합니다!");
        }
        await weapon.update({
            "system.props.bullets": currentBullets - costs.bullets
        });
    }

    // 효과 적용
    for (const effect of costs.effects) {
        const token = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
        if (!token) continue;

        const statusEffect = CONFIG.statusEffects.find(e => 
            e.id === effect.toLowerCase() ||
            e.label.toLowerCase() === effect.toLowerCase()
        );

        if (statusEffect) {
            await token.toggleEffect(statusEffect);
        }
    }
}

static async adjustAmmo(actorId, weaponId, amount) {
    try {
        const actor = game.actors.get(actorId);
        const weapon = actor?.items.get(weaponId);
        
        if (!actor || !weapon) return;

        const currentBullets = weapon.system.props.bullets || 0;
        const newAmount = Math.max(0, currentBullets + amount);

        await weapon.update({
            "system.props.bullets": newAmount
        });

        // 업데이트 후 화면 갱신
        if (window.ActorStatusManager) {
            window.ActorStatusManager.updateDisplay();
        }

        return newAmount;
    } catch (error) {
        console.error("Error adjusting ammo:", error);
        ui.notifications.error("탄약 조정 중 오류가 발생했습니다.");
    }
}

static async performQuickRoll(actorId, statType) {
    const actor = game.actors.get(actorId);
    if (!actor) return;

    try {
        new Dialog({
            title: `${this.ATTACK_TYPE_LABELS[statType] || statType} 판정`,
            content: `
                <form>
                    <div class="form-group">
                        <label>수정치:</label>
                        <input type="number" name="modifier" value="0">
                    </div>
                </form>
            `,
            buttons: {
                roll: {
                    icon: '<i class="fas fa-dice"></i>',
                    label: "굴림",
                    callback: (html) => {
                        const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
                        window.MetalicCombatSystem.CombatManager.performSimpleAttack(
                            [actor.id],
                            statType,
                            modifier
                        );
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소"
                }
            },
            default: "roll"
        }).render(true);
    } catch (error) {
        console.error("Error performing quick roll:", error);
        ui.notifications.error("판정 실행 중 오류가 발생했습니다.");
    }
}

static setupEventListeners(container) {
    if (!container) return;

    // 빠른 공격 버튼
    container.querySelectorAll('.quick-attack-button').forEach(button => {
        button.addEventListener('click', async () => {
            const weaponId = button.dataset.weaponId;
            const actorId = button.closest('[data-actor-id]').dataset.actorId;
            await this.performQuickAttack(actorId, weaponId);
        });
    });

    // 탄약 조절 버튼
    container.querySelectorAll('.ammo-adjust').forEach(button => {
        button.addEventListener('click', async () => {
            const amount = parseInt(button.dataset.amount);
            const weaponItem = button.closest('[data-weapon-id]');
            const actorId = weaponItem.dataset.actorId;
            const weaponId = weaponItem.dataset.weaponId;
            await this.adjustAmmo(actorId, weaponId, amount);
        });
    });

    // 빠른 판정 버튼
    container.querySelectorAll('.quick-roll-button').forEach(button => {
        button.addEventListener('click', async () => {
            const statType = button.closest('[data-stat-type]').dataset.statType;
            const actorId = button.closest('[data-actor-id]').dataset.actorId;
            await this.performQuickRoll(actorId, statType);
        });
    });

    // 무기 상세정보 토글
    container.querySelectorAll('.weapon-name').forEach(nameElement => {
        nameElement.addEventListener('click', () => {
            const weaponItem = nameElement.closest('.weapon-item');
            const details = weaponItem.querySelector('.weapon-details');
            details?.classList.toggle('expanded');
        });
    });

    // 템플릿 토글 버튼
    container.querySelectorAll('.template-toggle-button').forEach(button => {
        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            const weaponElem = button.closest('.weapon-item');
            const actorId = weaponElem.dataset.actorId;
            const weaponId = weaponElem.dataset.weaponId;
    
            const actor = game.actors.get(actorId);
            const token = canvas.tokens.placeables.find(t => t.actor?.id === actorId);
            const weapon = actor?.items.get(weaponId);
    
            if (!actor || !token || !weapon) return;
    
            // 여기서 무기 데이터 전달하는 부분을 수정
            if (button.classList.contains('active')) {
                await TemplateManager.deleteWeaponTemplates(weaponId);
                button.classList.remove('active');
            } else {
                const weaponData = {
                    _id: weapon.id,
                    name: weapon.name,
                    weaponcrit: weapon.system.props.weaponcrit || "0",
                    weapontype: weapon.system.props.weapontype || "",
                    weaponrange: weapon.system.props.weaponrange || "",
                    weaponcost: weapon.system.props.weaponcost || "",
                    weaponfinaldmg: weapon.system.props.weaponfinaldmg || "0",
                    weaponeffect: weapon.system.props.weaponeffect || "",
                    weapontarget: weapon.system.props.weapontarget || "",
                    weaponfx: weapon.system.props.weaponfx || "",
                    part: weapon.system.props.part || "근접",
                    weaponkind: weapon.system.props.weaponkind || "",
                    atk: actor.system.props.atk || "0",
                    sniping: weapon.system.props.sniping || false,
                    armorignore: weapon.system.props.armorignore || false
                };
    
                console.log('Creating templates with weapon data:', weaponData);
                await TemplateManager.createWeaponTemplates(weaponData, token);
                button.classList.add('active');
                Array.from(container.querySelectorAll('.template-toggle-button.active'))
                    .forEach(btn => {
                        if (btn !== button) {
                            btn.classList.remove('active');
                            const otherWeaponId = btn.closest('.weapon-item').dataset.weaponId;
                            TemplateManager.deleteWeaponTemplates(otherWeaponId);
                        }
                    });
            }
        });
    });
}

static _registerHooks() {
    // 아이템 추가/삭제/수정 시 화면 갱신
    Hooks.on('createItem', (item) => {
        if (this.window && item.parent instanceof Actor) {
            if (item.system?.props?.type === 'weapon') {
                this.updateDisplay();
            }
        }
    });

    Hooks.on('deleteItem', (item) => {
        if (this.window && item.parent instanceof Actor) {
            if (item.system?.props?.type === 'weapon') {
                this.updateDisplay();
            }
        }
    });

    Hooks.on('updateItem', (item, changes) => {
        if (this.window && item.parent instanceof Actor) {
            if (item.system?.props?.type === 'weapon') {
                this.updateDisplay();
            }
        }
    });

    // 액터 업데이트 시 화면 갱신 
    Hooks.on('updateActor', (actor, changes) => {
        if (this.window && changes.system?.props) {
            this.updateDisplay();
        }
    });

    // 토큰 업데이트 시 화면 갱신
    Hooks.on('updateToken', (token, changes) => {
        if (this.window && token.actor && changes.actorData) {
            this.updateDisplay(); 
        }
    });

    // 전투 시작/종료/업데이트 시 화면 갱신
    Hooks.on('createCombat', () => this.window && this.updateDisplay());
    Hooks.on('updateCombat', () => this.window && this.updateDisplay());
    Hooks.on('deleteCombat', () => this.window && this.updateDisplay());
}

static injectStyles() {
    const styles = `
        .combat-info-section {
            margin-top: 10px;
            padding: 12px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            color: #ddd;
            margin-bottom: 10px;
            padding-bottom: 6px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .combat-stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 12px;
        }

        .combat-stat-item {
            background: rgba(255, 255, 255, 0.1);
            padding: 8px;
            border-radius: 6px;
        }

        .stat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }

        .stat-label {
            font-size: 12px;
            color: #aaa;
        }

        .stat-value {
            font-weight: bold;
            color: white;
        }

        .combat-bonus-section {
            background: rgba(255, 255, 255, 0.05);
            padding: 8px;
            border-radius: 6px;
            margin-top: 8px;
        }

        .bonus-item {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            font-size: 12px;
            color: #aaa;
        }

        .weapon-section {
            margin-top: 16px;
        }

        .weapon-list {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .weapon-item {
            background: rgba(255, 255, 255, 0.1);
            padding: 10px;
            border-radius: 6px;
        }

        .weapon-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }

        .weapon-title {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .weapon-name {
            font-weight: bold;
            color: white;
            cursor: pointer;
        }

        .weapon-tags {
            display: flex;
            gap: 4px;
        }

        .weapon-tag {
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
            background: rgba(255, 255, 255, 0.1);
        }

        .weapon-tag.sniper { color: #ffc107; }
        .weapon-tag.penetrate { color: #dc3545; }
        .weapon-tag.psychic { color: #17a2b8; }
        .weapon-tag.jump { color: #28a745; }
        .weapon-tag.transition { color: #6f42c1; }
        .weapon-tag.awakening { color: #ff6b81; }        

        .ammo-display {
            background: rgba(255, 255, 255, 0.1);
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            color: #ddd;
        }

        .ammo-display.empty {
            color: #dc3545;
        }

        .weapon-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: #aaa;
        }

        .weapon-stats {
            display: flex;
            flex-wrap: wrap;  
            gap: 6px; 
            margin-bottom: 4px;  
        }

        .weapon-details {
            display: none;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .weapon-details.expanded {
            display: block;
        }

        .weapon-stats-detail {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 8px;
        }

        .weapon-effect {
            font-size: 12px;
            color: #aaa;
            background: rgba(0, 0, 0, 0.2);
            padding: 8px;
            border-radius: 4px;
        }

        .effect-label {
            font-weight: bold;
            margin-bottom: 4px;
            color: #ddd;
        }

        .weapon-controls {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 8px;
            flex-wrap: nowrap;
        }

        .template-toggle-button {
            padding: 4px 8px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            border-radius: 4px;
            cursor: pointer;
        }

        .template-toggle-button.active {
            background: rgba(255, 165, 0, 0.6);
        }

        .template-toggle-button:hover {
            background: rgba(255, 255, 255, 0.2);
        }        

        .ammo-controls {
            display: flex;
            align-items: center;
        }

        .ammo-buttons {
            display: flex;
            gap: 4px;
        }        

        .ammo-adjust {
            padding: 4px 8px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            border-radius: 4px;
            cursor: pointer;
        }

        .action-buttons {
            display: flex;
            gap: 4px;
            flex-shrink: 0;  /* 이 부분이 중요합니다 */
        }        

        .quick-attack-button {
            padding: 4px 12px;
            background: rgba(220, 53, 69, 0.6);
            border: none;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;            
        }

        .quick-attack-button:hover {
            background: rgba(220, 53, 69, 0.8);
        }

        .quick-roll-button {
            width: 100%;
            padding: 4px;
            background: rgba(255, 255, 255, 0.1);
            border: none;
            color: white;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
        }

        .quick-roll-button:hover {
            background: rgba(255, 255, 255, 0.2);
        }

        .empty-message {
               text-align: center;
               color: #aaa;
               padding: 12px;
               background: rgba(255, 255, 255, 0.05);
               border-radius: 6px;
               font-size: 12px;
           }

        .weapon-damage {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            background: rgba(220, 53, 69, 0.1);
            color: #dc3545;
            border-radius: 4px;
            font-size: var(--font-size-12);
        }

        .weapon-type, .weapon-range, .weapon-target, .weapon-damage {
            white-space: nowrap;
            padding: 2px 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            font-size: var(--font-size-12);
        }           
           
           /* Dialog 스타일 */
           .specialty-dialog {
               max-width: 500px;
           }

           .dialog-button {
               display: flex;
               align-items: center;
               justify-content: center;
               gap: 6px;
               padding: 6px 12px;
               border: none;
               border-radius: 4px;
               cursor: pointer;
               font-size: 14px;
               transition: background-color 0.2s;
           }

           .dialog-button.primary {
               background: #2c7be5;
               color: white;
           }

           .dialog-button.secondary {
               background: #6c757d;
               color: white;
           }

           .dialog-buttons {
               display: flex;
               justify-content: flex-end;
               gap: 8px;
               margin-top: 16px;
           }
       `;

       const styleSheet = document.createElement('style');
       styleSheet.textContent = styles;
       document.head.appendChild(styleSheet);
   }

   static _determineAttackType(part) {
    if (!part) return 'hit';
    const partLower = part.toLowerCase();
    
    if (partLower.includes('원격의 주무장') || partLower.includes('원격의 부무장')) {
        return 'shelling';
    }
    return 'hit';  // 백병의 주무장, 백병의 부무장인 경우
}

   /* 소켓 핸들러 */
   static async _handleQuickAttack(data) {
       const { actorId, weaponId } = data;
       return await this.performQuickAttack(actorId, weaponId);
   }

   static async _handleAdjustAmmo(data) {
       const { actorId, weaponId, amount } = data;
       return await this.adjustAmmo(actorId, weaponId, amount);
   }

   static async _handleQuickRoll(data) {
       const { actorId, statType } = data;
       return await this.performQuickRoll(actorId, statType);
   }
}

// Dialog 클래스 확장
class CombatSpecialtyDialog extends Dialog {
   static get defaultOptions() {
       return mergeObject(super.defaultOptions, {
           template: "templates/dialog.html",
           classes: ["dialog", "specialty-dialog"],
           width: 500,
           height: "auto"
       });
   }

   getData() {
       const data = super.getData();
       data.specialties = this.options.specialties;
       return data;
   }

   activateListeners(html) {
       super.activateListeners(html);
       
       html.find('.specialty-item').hover(
           function() { $(this).addClass('hover'); },
           function() { $(this).removeClass('hover'); }
       );

       html.find('.specialty-effect-toggle').click((event) => {
           const effect = $(event.currentTarget).closest('.specialty-item').find('.specialty-effect');
           effect.slideToggle(200);
       });
   }
}

export { CombatInfoManager, CombatSpecialtyDialog };

class SpecialtySelectionDialog extends Dialog {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["specialty-selection-dialog"],
            width: 800,
            height: 600,
            resizable: true
        });
    }
}