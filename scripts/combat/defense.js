import { DiceHelper } from '../utils/dice.js';
import { CombatManager } from './attack.js';

export class DefenseManager {
    static socket = null;

    static DEFENSE_OPTIONS = {
        evasion: { prop: "evasion", label: "회피", shortLabel: "회피" },
        pro: { prop: "pro", label: "방벽", shortLabel: "방벽" },
        init: { prop: "init", label: "행동", shortLabel: "행동" },
        shelling: { prop: "shelling", label: "포격", shortLabel: "포격" },
        hit: { prop: "hit", label: "명중", shortLabel: "명중" }
    };

    static ATTACK_TYPE_LABELS = {
        'hit': '명중',
        'shelling': '포격',
        'evasion': '회피',
        'pro': '방벽',
        'init': '행동'
    };

    static initialize(socketlib) {
        console.log('[DefenseManager] Initializing...');

        if (!socketlib) {
            console.error('[DefenseManager] No socketlib provided');
            return false;
        }

        try {
            this.socket = socketlib;
            console.log('[DefenseManager] Socket stored:', this.socket);

            this.socket.register('performDefense', this.performDefense.bind(this));
            console.log('[DefenseManager] performDefense registered');

            this.socket.register('updateChatMessageAsGM', this._updateChatMessageAsGM.bind(this));
            console.log('[DefenseManager] updateChatMessageAsGM registered');

            this.socket.register('deactivateDefenseEffects', this._handleDeactivateDefenseEffects.bind(this));

            return true;
        } catch (error) {
            console.error('[DefenseManager] Initialization error:', error);
            return false;
        }
    }

    static async _updateChatMessageAsGM(messageId, updateData) {
        if (!game.user.isGM) return;
        
        try {
            const message = game.messages.get(messageId);
            if (!message) {
                console.error('Message not found:', messageId);
                return;
            }
            
            console.log('Updating message as GM:', messageId);
            console.log('Update data:', updateData);
            
            await message.update(updateData);
            
            console.log('Message update successful');
            ui.chat.scrollBottom();  // 채팅창 스크롤 업데이트
            
        } catch (error) {
            console.error('Error updating message:', error, error.stack);
            ui.notifications.error("메시지 업데이트 중 오류가 발생했습니다.");
        }
    }

    static async performDefense(targetId, attackRoll, defenseType, modifier = 0, isAttackCritical = false, isAttackFumble = false, combatDataStr = null, fixedDefenseRoll = null, skipSpecialtyDialog = false, originalDiceResults = null) {
        console.log('[DefenseManager] performDefense called with:', {
            targetId,
            attackRoll,
            defenseType,
            modifier,
            isAttackCritical,
            isAttackFumble,
            combatDataStr,
            fixedDefenseRoll,
            originalDiceResults
        });
    
        if (!this.socket) {
            console.error('[DefenseManager] Socket not initialized');
            return null;
        }
    
        let attackerStats = { baseAttack: 0, attackType: 'hit' };
        if (combatDataStr) {
            try {
                const combatData = JSON.parse(decodeURIComponent(combatDataStr));
                console.log('Parsed combat data:', combatData);
    
                if (combatData.attacker) {
                    attackerStats = {
                        baseAttack: combatData.attacker.baseAttack || 0,
                        attackType: combatData.attacker.attackType || 'hit'
                    };
                }
            } catch (error) {
                console.error('[performDefense] Error parsing combat data:', error);
            }
        }
    
        const defenseOption = this.DEFENSE_OPTIONS[defenseType];
        if (!defenseOption) {
            console.error('[performDefense] Invalid defense type:', defenseType);
            return null;
        }
    
        const defenderToken = canvas.tokens.placeables.find(t => t.id === targetId);
        const defender = defenderToken ? defenderToken.actor : game.actors.get(targetId);
    
        if (!defender) {
            console.error('[performDefense] Defender not found');
            return null;
        }

        // 특기 선택 다이얼로그 표시
        let selectedSpecialties = [];
        if (fixedDefenseRoll === null && !skipSpecialtyDialog) {
            selectedSpecialties = await this._showDefenseSpecialtyDialog(defender);
            if (selectedSpecialties?.length) {
                const totalCost = this._calculateSpecialtyCost(selectedSpecialties);
                if (!await this._handleSpecialtyCost(totalCost, defender)) {
                    return;
                }
                await this._activateDefenseEffects(defender, selectedSpecialties);
            }
        }
    
        const defenseValue = DiceHelper.safeParseInt(defender.system.props[defenseOption.prop]);
        const diceBonus = DiceHelper.safeParseInt(defender.system.props.defdiebonus, 0);
        const numBonus = DiceHelper.safeParseInt(defender.system.props.defnumbonus, 0);
        const totalDefense = defenseValue + Number(modifier) + numBonus;
    
        console.log('[performDefense] Defense values:', {
            baseDefense: defenseValue,
            diceBonus,
            numBonus,
            totalDefense
        });
    
        let defenseRoll;
        let baseDiceResults;
        let baseDiceTotal;
        
        if (fixedDefenseRoll !== null) {
            // 고정된 방어 값 사용
            defenseRoll = new Roll(`${fixedDefenseRoll}`);
            
            if (originalDiceResults) {
                // 원본 주사위 결과가 있다면 사용
                defenseRoll.terms[0].results = originalDiceResults.map(result => ({result}));
            }
            
            await defenseRoll.evaluate({ async: true });
            baseDiceResults = defenseRoll.terms[0].results;
            baseDiceTotal = originalDiceResults ? 
                originalDiceResults.reduce((sum, result) => sum + result, 0) :
                Math.min(Math.max(fixedDefenseRoll - totalDefense, 2), 12);
            
            // 주사위 결과 HTML 생성을 위한 terms 설정
            defenseRoll.terms = [{
                faces: 6,
                results: baseDiceResults
            }];
        } else {
            // 실제 주사위 굴림
            const diceFormula = `2d6${diceBonus > 0 ? ` + ${diceBonus}d6` : ''}+${totalDefense}`;
            defenseRoll = new Roll(diceFormula);
            await defenseRoll.evaluate({ async: true });
        
            // 기본 주사위 결과 확인
            baseDiceResults = defenseRoll.terms[0].results;
            baseDiceTotal = baseDiceResults.reduce((sum, die) => sum + die.result, 0);
        
            if (game.dice3d) {
                try {
                    await game.dice3d.showForRoll(defenseRoll, game.user, true);
                } catch (error) {
                    console.error('[performDefense] Error showing 3D dice:', error);
                }
            }
        }

        // 펌블 체크
        const pumbleThreshold = DiceHelper.safeParseInt(defender.system.props.pumble, 2);
        const pumbleMod = DiceHelper.safeParseInt(defender.system.props.pumblemod, 0);
        const adjustedPumbleThreshold = Math.max(2, pumbleThreshold + pumbleMod);
        const isDefenseFumble = baseDiceTotal <= adjustedPumbleThreshold;

        // 방어 크리티컬 체크
        const defCritBase = DiceHelper.safeParseInt(defender.system.props.defcrit, 0);
        const defCritMod = DiceHelper.safeParseInt(defender.system.props.defcritmod, 0);
        const adjustedDefCritThreshold = defCritBase + defCritMod;
        const isDefenseCritical = adjustedDefCritThreshold > 0 && baseDiceTotal >= adjustedDefCritThreshold;

        // 방어 결과 계산
        let success = false;
        if (isAttackFumble) {
            success = true;
        } else if (isDefenseFumble) {
            success = false;
        } else if (isDefenseCritical) {
            success = true;
        } else if (isAttackCritical) {
            success = false;
        } else {
            success = defenseRoll.total >= attackRoll;
        }

        const margin = Math.abs(attackRoll - defenseRoll.total);

        const resultParams = {
            defender,
            defenderToken,
            defenseOption,
            defenseType,
            defenseValue,
            fixedDefenseRoll,
            modifierText: this._getModifierText(numBonus, modifier),
            diceBonus,
            roll: defenseRoll,
            diceResults: fixedDefenseRoll ? [] : this._getDiceResults(defenseRoll),
            attackRoll,
            success,
            margin,
            attackerStats,
            isDefenseFumble,
            isDefenseCritical,
            isAttackFumble,
            isAttackCritical,
            selectedSpecialties,
            combatDataStr,
            getResultText: () => this._getResultText(
                isDefenseFumble, 
                isDefenseCritical, 
                isAttackFumble, 
                isAttackCritical, 
                baseDiceTotal, 
                adjustedPumbleThreshold, 
                adjustedDefCritThreshold
            )
        };

        const resultContent = this._getDefenseResultHtml(resultParams);

        // 원본 메시지 업데이트
        const messages = game.messages.contents.reverse();
        for (const message of messages) {
            if (!message.content.includes('defense-controls')) continue;
        
            const content = message.content;
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
        
            const defenseControl = doc.querySelector(
                `.defense-controls button[data-target-id="${targetId}"][data-attack-roll="${attackRoll}"]`
            )?.closest('.defense-controls');
        
            if (defenseControl) {
                defenseControl.outerHTML = resultContent;
        
                // socketlib를 통해 GM에게 업데이트 요청
                await this.socket.executeForEveryone('updateChatMessageAsGM', message.id, {
                    content: doc.body.innerHTML
                });
        
                // 이 시점에서 남아있는 모든 방어 컨트롤을 다시 확인
                const updatedDoc = parser.parseFromString(doc.body.innerHTML, 'text/html');
                const remainingControls = updatedDoc.querySelectorAll('.defense-controls:has(button)').length;
        
                // 남은 컨트롤이 없을 때만 데미지 계산 및 특기 해제
                if (remainingControls === 0) {
                    try {
                        const combatData = JSON.parse(decodeURIComponent(combatDataStr));
                        console.log('Parsed combat data:', combatData);
        
                        if (combatData?.attacker) {
                            const hitTargets = [];
                            const targetSections = updatedDoc.querySelectorAll('.target-section');
                            targetSections.forEach(section => {
                                if (section.textContent.includes('명중!')) {
                                    const targetName = section.querySelector('.collapsible-header span')
                                        ?.textContent.replace('대상:', '').trim();
                                    if (targetName) {
                                        hitTargets.push(targetName);
                                    }
                                }
                            });
        
                            const isCritical = updatedDoc.querySelector('.attack-message')
                                ?.textContent.includes('크리티컬!') || false;
        
                            const attackingUserId = message.user?.id;
                            if (!attackingUserId) {
                                console.error('Could not find attacking user ID');
                                return;
                            }
        
                            const validUserIds = [attackingUserId];
        
                            const dialogData = {
                                weaponData: {
                                    name: combatData.weapon.name,
                                    weapontype: combatData.weapon.weapontype,
                                    weaponfinaldmg: combatData.weapon.weaponfinaldmg,
                                    sidedamage: combatData.weapon.sidedamage,
                                    weaponfx: combatData.weapon.weaponfx,
                                    atk: combatData.weapon.atk,
                                    part: combatData.weapon.part,
                                    weaponkind: combatData.weapon.weaponkind,
                                    sniping: combatData.weapon.sniping,
                                    armorignore: combatData.weapon.armorignore
                                },
                                attackerId: combatData.attacker.id,
                                hitTargets,
                                isCritical,
                                defenseSpecialties: selectedSpecialties,
                                defenderId: defender.id  
                            };
        
                            console.log('Sending dialog data:', dialogData);
                            await this.socket.executeForUsers("showDamageDialog", validUserIds, dialogData);
                        }
                    } catch (error) {
                        console.error('Error processing defense result:', error);
                        ui.notifications.error("방어 결과 처리 중 오류가 발생했습니다.");
                    }
                }
                break;
            }
        }
        
        return resultContent;
    }

    static async _showDefenseSpecialtyDialog(defender) {
        console.log("방어자 데이터:", defender);

        const selections = defender.items
        .filter(item =>
            (item.system?.props?.type === "specialty" &&
             (item.system?.props?.sselect === "방어시" || item.system?.props?.sselect === "공방시")) ||
            (item.system?.props?.type === "item" &&
             (item.system?.props?.iselect === "방어시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "weapon" && 
             (item.system?.props?.iselect === "방어시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "option" && 
             (item.system?.props?.iselect === "방어시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "bless" && 
             !item.system?.props?.use && 
             (item.system?.props?.iselect === "방어시" || item.system?.props?.iselect === "공방시"))
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
        
        // getTypeStyle 함수에 bless 타입 추가
        // 카테고리별로 분류
        const categorized = {
            specialty: selections.filter(s => s.type === 'specialty'),
            weapon: selections.filter(s => s.type === 'weapon'),
            item: selections.filter(s => s.type === 'item'),
            option: selections.filter(s => s.type === 'option'),
            bless: selections.filter(s => s.type === 'bless')
        };
    
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
    
        // 개별 효과 옵션 생성 함수
        const createEffectOption = (selection, idx) => `
            <div class="effect-option">
                <div class="checkbox-wrapper">
                    <input type="checkbox" 
                           id="effect${idx}" 
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
        `;
    
        return new Promise((resolve) => {
            new SpecialtySelectionDialog({    
                title: "특기/아이템 선택",
                content: `
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
                                categorized.specialty.map((selection, idx) => 
                                    createEffectOption(selection, idx)
                                ).join('') : 
                                '<div class="empty-tab-message">사용 가능한 특기가 없습니다</div>'}
                        </div>
                        
                        <div class="specialty-tab-content" data-tab="weapon">
                            ${categorized.weapon.length > 0 ? 
                                categorized.weapon.map((selection, idx) => 
                                    createEffectOption(selection, `weapon_${idx}`)
                                ).join('') : 
                                '<div class="empty-tab-message">사용 가능한 무장이 없습니다</div>'}
                        </div>
                        
                        <div class="specialty-tab-content" data-tab="item">
                            ${categorized.item.length > 0 ? 
                                categorized.item.map((selection, idx) => 
                                    createEffectOption(selection, `item_${idx}`)
                                ).join('') : 
                                '<div class="empty-tab-message">사용 가능한 아이템이 없습니다</div>'}
                        </div>
                        
                        <div class="specialty-tab-content" data-tab="option">
                            ${categorized.option.length > 0 ? 
                                categorized.option.map((selection, idx) => 
                                    createEffectOption(selection, `option_${idx}`)
                                ).join('') : 
                                '<div class="empty-tab-message">사용 가능한 옵션이 없습니다</div>'}
                        </div>
                        
                        <div class="specialty-tab-content" data-tab="bless">
                            ${categorized.bless.length > 0 ? 
                                categorized.bless.map((selection, idx) => 
                                    createEffectOption(selection, `bless_${idx}`)
                                ).join('') : 
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
                `,
                buttons: {
                    apply: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "적용",
                        callback: async (html) => {
                            const selectedIds = html.find('input[name="selectedEffects"]:checked')
                                .map((i, el) => ({ id: el.value, type: el.dataset.type }))
                                .get();
                            const selectedItems = selections.filter(s => selectedIds.some(sel => sel.id === s.id));
                        
                            // 선택된 가호들의 use 상태를 true로 변경
                            for (const selectedItem of selectedItems) {
                                if (selectedItem.type === 'bless' && selectedItem.item) {
                                    await selectedItem.item.update({
                                        "system.props.use": true
                                    });
                                }
                            }
                        
                            resolve(selectedItems);
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

    static _calculateSpecialtyCost(selectedSpecialties) {
        let totalCost = {
            fp: 0,
            hp: 0,
            en: 0,
            bullets: 0,
            effects: [],
            limits: selectedSpecialties
                .filter(specialty => 
                    specialty.limit !== undefined && 
                    specialty.item?.system?.props?.maxlimit > 0)  
                .map(specialty => ({
                    id: specialty.id,
                    name: specialty.name,
                    currentLimit: specialty.limit,
                    maxLimit: specialty.item?.system?.props?.maxlimit,
                    item: specialty.item
                }))
        };
    
        selectedSpecialties.forEach(specialty => {
            if (specialty?.cost) {
                const cost = specialty.cost.toLowerCase().replace(/\s+/g, '');
                console.log('비용 처리:', { 특기: specialty.name, 비용: cost });
    
                // 비용 패턴 찾기 (탄수 패턴 포함)
                const costMatches = [...cost.matchAll(/(\d+)?(fp|hp|en|탄수)(\d+)?/g)];
                console.log('찾은 비용 패턴:', costMatches);
    
                costMatches.forEach(match => {
                    const type = match[2];
                    const num1 = match[1] ? parseInt(match[1]) : 0;
                    const num2 = match[3] ? parseInt(match[3]) : 0;
                    const value = num1 || num2;
    
                    switch (type) {
                        case 'fp': totalCost.fp += value; break;
                        case 'hp': totalCost.hp += value; break;
                        case 'en': totalCost.en += value; break;
                        case '탄수': totalCost.bullets += value; break;
                    }
                });
    
                // 기타 효과 추출
                let remainingText = cost;
                costMatches.forEach(match => {
                    remainingText = remainingText.replace(match[0], ',');
                });
    
                const otherEffects = remainingText
                    .split(',')
                    .map(effect => effect.trim())
                    .filter(effect => effect !== '');
    
                totalCost.effects.push(...otherEffects);
            }
        });
    
        console.log('계산된 총 비용:', totalCost);
        return totalCost;
    }

    static async _handleSpecialtyCost(totalCost, defender, selectedSpecialties) {
        console.log("_handleSpecialtyCost 시작:", {
            totalCost,
            defender: defender?.name,
            selectedSpecialties
        });
        return new Promise((resolve) => {
            new Dialog({
                title: "방어 특기 비용 소비 확인",
                content: `
                    <style>
                        .cost-dialog {
                            background: #f0f0f0;
                            padding: 15px;
                            border-radius: 8px;
                        }
                        .cost-list {
                            background: white;
                            padding: 10px 15px;
                            border-radius: 6px;
                            margin: 10px 0;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                        }
                        .cost-item {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 4px 0;
                        }
                        .cost-label {
                            display: inline-flex;
                            align-items: center;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 12px;
                            font-weight: bold;
                        }
                        .fp-label { color: #2c7be5; }
                        .hp-label { color: #dc3545; }
                        .en-label { color: #6c757d; }
                        .bullet-label { color: #ffc107; }
                        .effect-label { color: #198754; }
                        .limit-option {
                            background: #f8f9fa;
                            padding: 8px;
                            border-radius: 6px;
                            margin-top: 10px;
                        }
                        .limit-item {
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            padding: 4px 0;
                        }
                        .limit-value {
                            margin-left: auto;
                            color: #666;
                            font-size: 12px;
                        }
                    </style>
                    <div class="cost-dialog">
                        <div class="cost-list">
                            ${totalCost.fp > 0 ? `
                                <div class="cost-item">
                                    <span class="cost-label fp-label">FP</span>
                                    <span>${totalCost.fp}</span>
                                </div>
                            ` : ""}
                            ${totalCost.hp > 0 ? `
                                <div class="cost-item">
                                    <span class="cost-label hp-label">HP</span>
                                    <span>${totalCost.hp}</span>
                                </div>
                            ` : ""}
                            ${totalCost.en > 0 ? `
                                <div class="cost-item">
                                    <span class="cost-label en-label">EN</span>
                                    <span>${totalCost.en}</span>
                                </div>
                            ` : ""}
                            ${totalCost.bullets > 0 ? `
                                <div class="cost-item">
                                    <span class="cost-label bullet-label">탄수</span>
                                    <span>${totalCost.bullets}</span>
                                </div>
                            ` : ""}
                            ${totalCost.effects.length > 0 ? `
                                <div class="cost-item">
                                    <span class="cost-label effect-label">효과</span>
                                    <span>${totalCost.effects.join(", ")}</span>
                                </div>
                            ` : ""}
                        </div>
                        ${totalCost.limits?.length > 0 ? `
                            <div class="limit-option">
                                ${totalCost.limits.map(limit => `
                                    <div class="limit-item">
                                        <input type="checkbox" 
                                               id="limit_${limit.id}" 
                                               name="consumeLimit" 
                                               data-specialty-id="${limit.id}"
                                               checked>
                                        <label for="limit_${limit.id}">${limit.name?.replace('$', '')} 사용횟수 소비</label>
                                        <span class="limit-value">현재: ${limit.currentLimit}회</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>`,
                buttons: {
                    confirm: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "소비",
                        callback: async (html) => {
                            try {
                                // 사용횟수 처리
                                if (totalCost.limits?.length > 0) {
                                    const checkedLimits = html.find('input[name="consumeLimit"]:checked')
                                        .map((i, el) => $(el).data('specialty-id'))
                                        .get();
    
                                    for (const specialtyId of checkedLimits) {
                                        const limitInfo = totalCost.limits.find(l => l.id === specialtyId);
                                        if (limitInfo && limitInfo.item) {
                                            if (limitInfo.currentLimit <= 0) {
                                                ui.notifications.warn(`${limitInfo.name} 특기의 사용횟수가 부족합니다!`);
                                                return resolve(false);
                                            }
                                            await limitInfo.item.update({
                                                "system.props.limit": limitInfo.currentLimit - 1
                                            });
                                        }
                                    }
                                }
    
                                // FP 소비
                                if (totalCost.fp > 0) {
                                    let fpValue = defender.system.props.fpvalue;
                                    await defender.update({
                                        "system.props.fpvalue": fpValue - totalCost.fp
                                    });
                                }
    
                                // HP 소비
                                if (totalCost.hp > 0) {
                                    let hpValue = defender.system.props.hpvalue;
                                    await defender.update({
                                        "system.props.hpvalue": hpValue - totalCost.hp
                                    });
                                }
    
                                // EN 소비
                                if (totalCost.en > 0) {
                                    let enValue = defender.system.props.envalue;
                                    await defender.update({
                                        "system.props.envalue": enValue - totalCost.en
                                    });
                                }
    
                                // 탄수 소비
                                if (totalCost.bullets > 0) {
                                    for (const specialty of totalCost.limits) {
                                        if (specialty.item) {
                                            const currentBullets = specialty.item.system.props.bullets || 0;
                                            if (currentBullets >= totalCost.bullets) {
                                                await specialty.item.update({
                                                    "system.props.bullets": currentBullets - totalCost.bullets
                                                });
                                                break;
                                            }
                                        }
                                    }
                                }
    
                                // 효과 적용
                                for (let effect of totalCost.effects) {
                                    if (effect) {
                                        let token = canvas.tokens.controlled[0];
                                        
                                        if (!token) {
                                            const tokens = canvas.tokens.placeables.filter(t => t.actor?.id === attacker.id);
                                            token = tokens[0];
                                        }
    
                                        if (token) {
                                            await this._applyEffect(token, effect);
                                        } else {
                                            console.warn(`토큰을 찾을 수 없습니다: ${attacker.name}`);
                                            ui.notifications.warn(`${effect} 상태를 적용할 토큰을 찾을 수 없습니다.`);
                                        }
                                    }
                                }
    
                                resolve(true);
                            } catch (error) {
                                console.error("데미지 특기 비용 처리 중 오류 발생:", error);
                                ui.notifications.error("비용 처리 중 오류가 발생했습니다.");
                                resolve(false);
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

    static async _activateDefenseEffects(defender, selectedSpecialties) {
        try {
            let activeGroups = defender.system.activeConditionalModifierGroups || [];

            // 선택된 특기들에 대해
            for (const specialty of selectedSpecialties) {
                const specialtyItem = defender.items.find(i => i.name === specialty.name?.replace('$', ''));
                if (!specialtyItem) continue;

                const modifierGroups = specialtyItem.system.modifiers
                    ?.filter(m => m.conditionalGroup)
                    ?.map(m => m.conditionalGroup) || [];

                // 그룹들 활성화
                modifierGroups.forEach(group => {
                    if (!activeGroups.includes(group)) {
                        activeGroups.push(group);
                    }
                });
            }

            await defender.update({
                "system.activeConditionalModifierGroups": activeGroups
            });

            ui.notifications.info(`선택한 방어 특기 효과들이 활성화되었습니다.`);
        } catch (error) {
            console.error("방어 효과 활성화 중 오류 발생:", error);
            ui.notifications.error("효과 활성화 중 오류가 발생했습니다.");
        }
    }

    static async _deactivateDefenseEffects(defender, selectedSpecialties) {
        try {
            let activeGroups = defender.system.activeConditionalModifierGroups || [];

            // 선택된 특기들의 효과 제거
            for (const specialty of selectedSpecialties) {
                const specialtyItem = defender.items.find(i => i.name === specialty.name?.replace('$', ''));
                if (!specialtyItem) continue;

                const modifierGroups = specialtyItem.system.modifiers
                    ?.filter(m => m.conditionalGroup)
                    ?.map(m => m.conditionalGroup) || [];

                // 해당 특기의 그룹들 제거
                activeGroups = activeGroups.filter(group => !modifierGroups.includes(group));
            }

            // 업데이트
            await defender.update({
                "system.activeConditionalModifierGroups": activeGroups
            });

            ui.notifications.info("방어 특기 효과가 종료되었습니다.");
        } catch (error) {
            console.error("방어 효과 비활성화 중 오류 발생:", error);
        }
    }

    static async _applyEffect(token, effectName) {
        if (effectName.toLowerCase().trim() === '없음') {
            return;
        }

        const statusId = effectName.toLowerCase().trim();
        const statusEffect = CONFIG.statusEffects.find(e =>
            e.id === statusId ||
            e.label.toLowerCase() === statusId
        );

        if (!statusEffect) {
            ui.notifications.warn(`${effectName} 상태가 시스템에 등록되어 있지 않습니다.`);
            return;
        }

        try {
            const hasEffect = token.document.hasStatusEffect(statusEffect.id);
            if (!hasEffect) {
                await token.toggleEffect(statusEffect);
                ui.notifications.info(`${effectName} 상태가 적용되었습니다.`);
            } else {
                ui.notifications.info(`${effectName} 상태가 이미 적용되어 있습니다.`);
            }
        } catch (error) {
            ui.notifications.error(`${effectName} 상태 적용 실패: ${error}`);
            console.error(error);
        }
    }

    // 유틸리티 메서드들
    static _getModifierText(numBonus, modifier) {
        let modDescription = [];
        if (numBonus !== 0) modDescription.push(`캐릭터 보너스: ${numBonus >= 0 ? '+' : ''}${numBonus}`);
        if (modifier !== 0) modDescription.push(`상황 수정치: ${modifier >= 0 ? '+' : ''}${modifier}`);
        return modDescription.length > 0 ? ` (${modDescription.join(', ')})` : '';
    }

    static _getDiceResults(roll) {
        return roll.terms
            .filter(term => term.faces === 6)
            .map(term => term.results.map(r => this._getDiceHtml(r.result)).join('')).join('');
    }

    static _getResultText(isDefenseFumble, isDefenseCritical, isAttackFumble, isAttackCritical, baseDiceTotal, pumbleThreshold, defCritThreshold) {
        if (isDefenseFumble) return `펌블! (2d6: ${baseDiceTotal} ≤ ${pumbleThreshold})`;
        if (isDefenseCritical) return `방어 크리티컬! (2d6: ${baseDiceTotal} ≥ ${defCritThreshold})`;
        if (isAttackFumble) return `공격측 펌블!`;
        if (isAttackCritical) return `공격측 크리티컬!`;
        return '';
    }

    static _getDiceHtml(result) {
        return `
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
                ${result}
            </div>`;
    }

    static _getDefenseResultHtml(params) {
        const {
            defender,
            defenderToken,
            defenseOption,
            defenseType,
            defenseValue,
            fixedDefenseRoll,
            modifierText,
            diceBonus,
            roll,
            diceResults,
            attackRoll,
            success,
            margin,
            isDefenseFumble,
            isDefenseCritical,
            isAttackFumble,
            isAttackCritical,
            getResultText,
            damageContent,
            attackerStats = { baseAttack: 0, attackType: 'hit' },
            selectedSpecialties = [],
            combatDataStr 
        } = params;

        return `
        <div class="defense-controls collapsible-card collapsed" 
            data-target-id="${defenderToken?.id || defender.id}"
            data-actor-id="${params.defender.id}"
            data-attack-roll="${params.attackRoll}"
            data-is-critical="${params.isCritical}"
            data-is-fumble="${params.isFumble}"
            data-combat-data="${params.combatDataStr}"
            data-defense-type="${params.defenseType}"
            style="
                background: #f0f0f0;
                border-radius: 10px;
                padding: 8px;
                margin-bottom: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                
                <div class="collapsible-header" style="
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: white;
                    padding: 6px 10px;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    
                    <i class="fas fa-chevron-down collapse-icon" style="
                        color: #4a4a4a;
                        transition: transform 0.3s ease;"></i>
                    <h3 style="
                        margin: 0;
                        font-size: var(--font-size-14);
                        color: #4a4a4a;">
                        ${defender.name}의 ${defenseOption.label}
                    </h3>
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-left: auto;">
                    <span style="
                        background: #e9ecef;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: var(--font-size-12);
                        color: #4a4a4a;">
                        ${this.ATTACK_TYPE_LABELS[attackerStats.attackType] || attackerStats.attackType}[${attackerStats.baseAttack}] ${attackRoll} vs ${defenseOption.label}[${defenseValue}] ${roll.total}
                    </span>
                    </div>
                </div>
    
                <div class="collapsible-content">
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
                                    2d6${diceBonus > 0 ? ` + ${diceBonus}d6` : ''} + ${defenseValue}${modifierText}
                                </span>
                            </div>
        
                            <div style="
                                display: flex;
                                align-items: center;
                                justify-content: space-between;
                                background: #f8f9fa;
                                border-radius: 6px;
                                padding: 4px 8px;">
                                <div class="defense-dice-container" style="display: flex; gap: 4px;">
                                    ${params.baseDiceResults ? params.baseDiceResults.map(die => `
                                        <div class="roll die defense-die" style="
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
                                            ${die.result}
                                        </div>
                                    `).join('') : roll.terms
                                        .filter(term => term.faces === 6)
                                        .map(term => term.results.map(r => `
                                            <div class="roll die defense-die" style="
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
                                            </div>
                                        `).join('')).join('')}
                                </div>
                                ${fixedDefenseRoll !== null ? `
                                <span style="
                                    font-size: var(--font-size-16);
                                    font-weight: bold;
                                    padding: 2px 8px;
                                    background: #4a4a4a;
                                    color: white;
                                    border-radius: 4px;">
                                    ${roll.total}
                                    <i class="fas fa-edit" style="font-size: 12px;" title="수정된 값"></i>
                                </span>
                                ` : `
                                <span style="
                                    font-size: var(--font-size-16);
                                    font-weight: bold;
                                    padding: 2px 8px;
                                    background: #4a4a4a;
                                    color: white;
                                    border-radius: 4px;">
                                    ${roll.total}           
                                </span>       
                                `}                                                  
                            </div>
    
                            ${selectedSpecialties?.length > 0 ? `
                                <div class="specialty-section collapsible-card collapsed" style="
                                    margin-top: 6px;
                                    background: rgba(255,255,255,0.5);
                                    border-radius: 6px;">
                                    
                                    <div class="collapsible-header" style="
                                        padding: 6px 10px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: space-between;
                                        cursor: pointer;">
                                        <div style="
                                            display: flex;
                                            align-items: center;
                                            gap: 8px;">
                                            <i class="fas fa-chevron-down collapse-icon" style="
                                                color: #666;
                                                transition: transform 0.3s ease;"></i>
                                            <strong style="color: #666;">사용된 특기</strong>
                                        </div>
                                        <span style="
                                            background: #e9ecef;
                                            padding: 2px 6px;
                                            border-radius: 4px;
                                            font-size: var(--font-size-12);
                                            color: #666;">
                                            ${selectedSpecialties.length}개
                                        </span>
                                    </div>
                            
                                            <div class="collapsible-content" style="
                                                display: none !important; 
                                                height: 0 !important; 
                                                opacity: 0 !important; 
                                                margin: 0 !important; 
                                                padding: 0 !important;">
                                                ${selectedSpecialties.map(specialty => `
                                                <div class="specialty-button" style="
                                                background: white;
                                                margin-top: 6px;
                                                padding: 8px;
                                                border-radius: 4px;
                                                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                                                cursor: pointer;"
                                                data-specialty-id="${specialty.id}"
                                                data-specialty-name="${specialty.name?.replace('$', '')}"
                                                data-specialty-level="${specialty.level?.replace('$', '') || ''}"
                                                data-specialty-timing="${specialty.timing?.replace('$', '') || ''}"
                                                data-specialty-target="${specialty.target?.replace('$', '') || ''}"
                                                data-specialty-range="${specialty.range?.replace('$', '') || ''}"
                                                data-specialty-cost="${specialty.cost?.replace('$', '') || ''}"
                                                data-specialty-effect="${specialty.effect?.replace('$', '') || ''}">
                                                
                                                <div style="display:flex;align-items:center;justify-content:space-between">
                                                    <div style="display:flex;align-items:center;gap:6px">
                                                        <span style="font-weight: bold; color: #4a4a4a;">
                                                            ${specialty.name?.replace('$', '')}
                                                        </span>
                                                        ${specialty.level ? `
                                                            <span style="
                                                                background: #e9ecef;
                                                                padding: 2px 6px;
                                                                border-radius: 4px;
                                                                font-size: var(--font-size-12);
                                                                color: #4a4a4a;">
                                                                LV.${specialty.level?.replace('$', '')}
                                                            </span>
                                                        ` : ''}
                                                    </div>
                                                    <i class="fas fa-info-circle" style="color: #666;"></i>
                                                </div>
                            
                                                <div style="
                                                    display: flex;
                                                    flex-wrap: wrap;
                                                    gap: 4px;
                                                    margin-top: 4px;">
                                                    ${[
                                                        specialty.timing && `<span style="background:#f8f9fa;padding:2px 6px;border-radius:4px;font-size:var(--font-size-12);color:#666">${specialty.timing?.replace('$', '')}</span>`,
                                                        specialty.target && `<span style="background:#f8f9fa;padding:2px 6px;border-radius:4px;font-size:var(--font-size-12);color:#666">${specialty.target?.replace('$', '')}</span>`,
                                                        specialty.range && `<span style="background:#f8f9fa;padding:2px 6px;border-radius:4px;font-size:var(--font-size-12);color:#666">${specialty.range?.replace('$', '')}</span>`,
                                                        specialty.cost && `<span style="background:#f8f9fa;padding:2px 6px;border-radius:4px;font-size:var(--font-size-12);color:#666">${specialty.cost?.replace('$', '')}</span>`
                                                    ].filter(Boolean).join('')}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
        
                            <div style="
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                gap: 20px;
                                margin-top: 8px;
                                padding: 4px;
                                background: #f8f9fa;
                                border-radius: 4px;">
                                <div style="text-align: center;">
                                 <div style="font-size: var(--font-size-12); color: #666;">
                                 ${this.ATTACK_TYPE_LABELS[attackerStats.attackType] || attackerStats.attackType}[${attackerStats.baseAttack}]
                                </div>
                                <div style="font-weight: bold; color: #4a4a4a;">${attackRoll}</div>
                                </div>
                                <div style="font-weight: bold; color: #666;">VS</div>
                                <div style="text-align: center;">
                                    <div style="font-size: var(--font-size-12); color: #666;">${defenseOption.label}[${defenseValue}]</div>
                                    <div style="font-weight: bold; color: #4a4a4a;">${roll.total}</div>
                                </div>
                            </div>
        
                            ${(isDefenseFumble || isDefenseCritical || isAttackFumble || isAttackCritical) ? `
                                <div style="
                                    background: ${isDefenseFumble || isAttackCritical ? '#dc3545' : '#28a745'};
                                    color: white;
                                    padding: 4px;
                                    border-radius: 4px;
                                    margin-top: 4px;
                                    text-align: center;
                                    font-size: var(--font-size-12);
                                    font-weight: bold;">
                                    ${getResultText()}
                                </div>
                            ` : ''}
        
                            <div style="
                                text-align: center;
                                margin-top: 4px;
                                padding: 4px;
                                font-weight: bold;
                                color: ${success ? '#28a745' : '#dc3545'};
                                font-size: var(--font-size-14);">
                                ${success ? "회피!" : "명중!"} (차이: ${margin})
                            </div>
                        </div>
        
                        ${params.damageContent ? params.damageContent : ''}
                    </div>
                </div>`
    }

    static async _calculateDamageContent(weaponData) {
        if (!weaponData) return '';

        let formulaParts = ['2d6'];// 공격력 추가
        if (weaponData.atk && weaponData.atk !== '0') {
            formulaParts.push(weaponData.atk.replace('$', ''));
        }

        // 기본 대미지 추가
        if (weaponData.weaponfinaldmg && weaponData.weaponfinaldmg !== '0') {
            formulaParts.push(weaponData.weaponfinaldmg.replace('$', ''));
        }

        // 공격력 추가
        if (weaponData.atk && weaponData.atk !== '0') {
            formulaParts.push(weaponData.atk.replace('$', ''));
        }

        // 대미지 주사위 보너스 추가
        if (weaponData.dmgdiebonus && weaponData.dmgdiebonus !== '0') {
            formulaParts.push(`${weaponData.dmgdiebonus.replace('$', '')}d6`);
        }

        // 대미지 수치 보너스 추가
        if (weaponData.dmgnumbonus && weaponData.dmgnumbonus !== '0') {
            formulaParts.push(weaponData.dmgnumbonus.replace('$', ''));
        }

        const damageFormula = formulaParts.join('+');

        try {
            const damageRoll = new Roll(damageFormula);
            await damageRoll.evaluate({ async: true });

            if (game.dice3d) {
                await game.dice3d.showForRoll(damageRoll, game.user, true);
            }

            const damageDiceResults = damageRoll.dice.map(d => d.results.map(r => this._getDiceHtml(r.result)).join('')).join('');

            return `
                <div style="
                    margin-top: 12px;
                    border-top: 2px solid #ddd;
                    padding-top: 12px;">
                    
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        background: white;
                        padding: 6px 10px;
                        border-radius: 8px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                        <h3 style="
                            margin: 0;
                            font-size: var(--font-size-14);
                            color: #4a4a4a;">
                            ${weaponData.name.replace('$', '')} - 대미지
                        </h3>
                        <span style="
                            background: #e9ecef;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #4a4a4a;">
                            ${weaponData.weapontype.replace('$', '')}
                        </span>
                    </div>

                    <div style="
                        background: white;
                        border-radius: 8px;
                        padding: 8px;
                        margin-top: 6px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                        
                        <div style="
                            font-size: var(--font-size-12);
                            color: #666;
                            margin-bottom: 4px;">
                            ${damageFormula}
                        </div>

                        <div style="
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            background: #f8f9fa;
                            border-radius: 6px;
                            padding: 4px 8px;">
                            
                            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                                ${damageDiceResults}
                            </div>
                            
                            <span style="
                                font-size: var(--font-size-16);
                                font-weight: bold;
                                padding: 2px 8px;
                                background: #dc3545;
                                color: white;
                                border-radius: 4px;">
                                ${damageRoll.total}
                            </span>
                        </div>
                    </div>
                </div>`;

        } catch (error) {
            console.error('[_calculateDamageContent] Error calculating damage:', error);
            ui.notifications.error("대미지 계산 중 오류가 발생했습니다.");
            return '';
        }
    }

    // 방어 재굴림
    static async rerollDefense(message, fixedResult = null, originalDiceResults = null) {
        try {
            console.log('Starting defense reroll');
            const parser = new DOMParser();
            const doc = parser.parseFromString(message.content, 'text/html');
    
            // 전체 attack-message와 dataset 찾기
            const attackMessage = doc.querySelector('.attack-message');
            if (!attackMessage) {
                console.error('Attack message not found');
                return;
            }
    
            // 기존의 모든 dataset 복사
            const allDataset = { ...attackMessage.dataset };

            const originalRoll = message.rolls?.[0];
            if (originalRoll) {
                allDataset.originalRollTotal = originalRoll.total;
                allDataset.originalDiceResults = JSON.stringify(originalRoll.terms[0].results);
            }
    
            // 현재 방어 컨트롤 찾기
            const currentDefenseControls = doc.querySelector('.defense-controls');
            if (!currentDefenseControls) {
                console.error('Defense controls not found');
                return;
            }
    
            // 데이터 추출
            const targetId = currentDefenseControls.dataset.targetId;
            const attackRoll = parseInt(currentDefenseControls.dataset.attackRoll);
            const isAttackCritical = currentDefenseControls.dataset.isCritical === 'true';
            const isAttackFumble = currentDefenseControls.dataset.isFumble === 'true';
            const combatDataStr = currentDefenseControls.dataset.combatData;
            const defenseType = currentDefenseControls.dataset.defenseType;
    
            // 새 방어 굴림 실행
            const newDefenseResult = await this.performDefense(
                targetId,
                attackRoll,
                defenseType,
                0,
                isAttackCritical,
                isAttackFumble,
                combatDataStr,
                fixedResult,
                true,
                originalDiceResults 
            );
    
            // 기존 방어 컨트롤을 새로운 결과로 교체
            const clone = attackMessage.cloneNode(true);
            const cloneDefenseControls = clone.querySelector('.defense-controls');
            cloneDefenseControls.outerHTML = newDefenseResult;
    
            // 원본의 모든 dataset을 새 카드에 복원
            Object.entries(allDataset).forEach(([key, value]) => {
                clone.dataset[key] = value;
            });
    
            // 새 채팅 메시지 생성
            await ChatMessage.create({
                content: clone.outerHTML,
                speaker: message.speaker,
                type: CONST.CHAT_MESSAGE_TYPES.ROLL,
                rolls: message.rolls
            });
    
            console.log('New message created with rerolled defense');
    
        } catch (error) {
            console.error('Error during defense reroll:', error, error.stack);
            ui.notifications.error("방어 재굴림 중 오류가 발생했습니다.");
        }
    }

    static async _handleDeactivateDefenseEffects(defenderId, specialties) {
        if (!game.user.isGM) return;
        
        const defender = game.actors.get(defenderId);
        if (!defender) {
            console.error('Defender not found:', defenderId);
            return;
        }
        
        try {
            let activeGroups = defender.system.activeConditionalModifierGroups || [];
    
            for (const specialty of specialties) {
                const specialtyItem = defender.items.find(i => i.name === specialty.name?.replace('$', ''));
                if (!specialtyItem) continue;
    
                const modifierGroups = specialtyItem.system.modifiers
                    ?.filter(m => m.conditionalGroup)
                    ?.map(m => m.conditionalGroup) || [];
    
                activeGroups = activeGroups.filter(group => !modifierGroups.includes(group));
            }
    
            await defender.update({
                "system.activeConditionalModifierGroups": activeGroups
            });
    
            ui.notifications.info("방어 특기 효과가 종료되었습니다.");
        } catch (error) {
            console.error("방어 효과 비활성화 중 오류 발생:", error);
        }
    }

    static async modifyDefenseResult(message) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(message.content, 'text/html');
            
            // 원본 롤과 주사위 결과 가져오기
            let originalDiceResults;
            let originalTotal;
    
            // 먼저 message.rolls에서 확인
            const originalRoll = message.rolls?.[0];
            if (originalRoll) {
                originalDiceResults = originalRoll.terms[0].results.map(r => r.result);
                originalTotal = originalRoll.total;
            } else {
                // rolls가 없다면 dataset에서 확인
                const defenseControls = doc.querySelector('.defense-controls');
                originalTotal = parseInt(defenseControls?.dataset.originalRollTotal);
                originalDiceResults = defenseControls?.dataset.originalDiceResults ? 
                    JSON.parse(defenseControls.dataset.originalDiceResults) : null;
            }
    
            if (isNaN(originalTotal) || !originalDiceResults) {
                // VS 섹션에서 방어값 찾기
                const vsMatch = message.content.match(/(회피|방벽|행동|포격)\[(\d+)\]\s*(\d+)/);
                if (!vsMatch) {
                    ui.notifications.error("방어 결과값을 찾을 수 없습니다.");
                    return;
                }
                originalTotal = parseInt(vsMatch[3]);
    
                // DOM에서 방어 주사위 결과 수집
                originalDiceResults = [];
                const defenseDiceContainer = doc.querySelector('.defense-dice-container');
                if (defenseDiceContainer) {
                    const diceElements = defenseDiceContainer.querySelectorAll('.roll.die.defense-die');
                    diceElements.forEach(die => {
                        const result = parseInt(die.textContent.trim());
                        if (!isNaN(result)) {
                            originalDiceResults.push(result); // 숫자만 push
                        }
                    });
                }
            }
    
            console.log('Original defense roll:', { total: originalTotal, diceResults: originalDiceResults });
    
            new Dialog({
                title: "방어값 수정",
                content: `
                    <form>
                        <div class="form-group">
                            <label>현재 결과값: ${originalTotal}</label>
                            <br>
                            <label>수정치:</label>
                            <input type="number" name="modifier" value="0">
                            <p class="notes">양수는 증가, 음수는 감소</p>
                        </div>
                    </form>
                `,
                buttons: {
                    submit: {
                        icon: '<i class="fas fa-check"></i>',
                        label: "적용",
                        callback: async (html) => {
                            const modifier = parseInt(html.find('[name="modifier"]').val()) || 0;
                            const newTotal = originalTotal + modifier;
                            if (game.dice3d) game.dice3d.messageHookDisabled = true;
                            await this.rerollDefense(message, newTotal, originalDiceResults);
                            if (game.dice3d) game.dice3d.messageHookDisabled = false;
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: "취소"
                    }
                },
                default: "submit"
            }).render(true);
    
        } catch (error) {
            console.error('Error modifying defense result:', error);
            ui.notifications.error("방어값 수정 중 오류가 발생했습니다.");
        }
    }
}

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

