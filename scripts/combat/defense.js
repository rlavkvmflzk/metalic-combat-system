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
/**
 * 방어 시 사용할 수 있는 특기, 아이템 등을 선택하는 다이얼로그를 표시합니다.
 * @param {Actor} defender - 방어자 액터
 * @returns {Promise<Array>} 선택된 아이템 객체의 배열
 */
static async _showDefenseSpecialtyDialog(defender) {
    // =======================================================================
    // 1. 아이템 필터링 및 데이터 가공 (룰 로직 - 원본과 100% 동일)
    // =======================================================================
    const selections = defender.items
        .filter(item =>
            (item.system?.props?.type === "specialty" && (item.system?.props?.sselect === "방어시" || item.system?.props?.sselect === "공방시")) ||
            (item.system?.props?.type === "item" && (item.system?.props?.iselect === "방어시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "weapon" && (item.system?.props?.iselect === "방어시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "option" && (item.system?.props?.iselect === "방어시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "bless" && !item.system?.props?.use && (item.system?.props?.iselect === "방어시" || item.system?.props?.iselect === "공방시"))
        )
        .map(item => {
            const props = item.system.props;
            switch (props.type) {
                case "specialty":
                    return { id: item.id, name: item.name, type: 'specialty', cost: props.scost, level: props.slv, target: props.starget, range: props.srange, timing: props.stiming, effect: props.seffect, modifiers: item.system.modifiers || [], limit: props.limit, item: item };
                case "weapon":
                    return { id: item.id, name: item.name, type: 'weapon', timing: '공격시', target: props.weapontarget, effect: props.weaponeffect, item: item };
                case "option":
                    return { id: item.id, name: item.name, type: 'option', cost: props.optioncost, timing: '공격시', effect: props.optioneffect, item: item };
                case "bless":
                    return { id: item.id, name: item.name, type: 'bless', timing: props.btiming, target: props.btarget, effect: props.beffect, item: item, use: props.use || false };
                default: // "item"
                    return { id: item.id, name: item.name, type: 'item', cost: props.icost, timing: props.itiming, effect: props.ieffect, item: item };
            }
        });

    if (!selections.length) return [];

    const categorized = {
        specialty: selections.filter(s => s.type === 'specialty'),
        weapon: selections.filter(s => s.type === 'weapon'),
        item: selections.filter(s => s.type === 'item'),
        option: selections.filter(s => s.type === 'option'),
        bless: selections.filter(s => s.type === 'bless')
    };

    // =======================================================================
    // 2. 다이얼로그 생성 및 표시 (구조 및 스타일링 로직)
    // =======================================================================
    // ★★★★★ 오류 수정: labelMap을 함수 최상단으로 이동 ★★★★★
    const labelMap = { specialty: '특기', weapon: '무장', item: '아이템', option: '옵션', bless: '가호' };

    const tabButtons = Object.entries(categorized).filter(([, items]) => items.length > 0).map(([key, items]) => {
        const iconMap = { specialty: 'fa-star', weapon: 'fa-sword', item: 'fa-box', option: 'fa-cog', bless: 'fa-crown' };
        return `<button class="mcs-dialog-tab" data-tab="${key}"><i class="fas ${iconMap[key]}"></i> ${labelMap[key]}<span class="mcs-dialog-tab-count">${items.length}</span></button>`;
    }).join('');

    const tabContents = Object.entries(categorized).map(([key, items]) => `
        <div class="mcs-dialog-tab-content" data-tab="${key}">
            ${items.length > 0
                ? items.map((selection, idx) => this._createEffectOptionHtml(selection, `${key}_${idx}`)).join('')
                : `<div class="mcs-dialog-empty-message">사용 가능한 ${labelMap[key]}가 없습니다</div>` // 이제 여기서 labelMap 접근 가능
            }
        </div>`).join('');

    const content = `<div class="mcs-dialog-tabs">${tabButtons}</div><div class="mcs-dialog-content-wrapper">${tabContents}</div>`;

    return new Promise((resolve) => {
        new Dialog({
            title: "방어 특기/아이템 선택",
            content: content,
            buttons: {
                apply: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "적용",
                    callback: async (html) => {
                        const selectedIds = html.find('input[name="selectedEffects"]:checked').map((i, el) => el.value).get();
                        const selectedItems = selections.filter(s => selectedIds.includes(s.id));
                        for (const selectedItem of selectedItems) {
                            if (selectedItem.type === 'bless' && selectedItem.item) {
                                await selectedItem.item.update({ "system.props.use": true });
                            }
                        }
                        resolve(selectedItems);
                    }
                },
                cancel: { icon: '<i class="fas fa-times"></i>', label: "취소", callback: () => resolve([]) }
            },
            default: "apply",
            render: (html) => {
                const tabs = html.find('.mcs-dialog-tab');
                const contents = html.find('.mcs-dialog-tab-content');
                tabs.first().addClass('active');
                contents.first().addClass('active');
                tabs.on('click', (event) => {
                    const tab = $(event.currentTarget);
                    tabs.removeClass('active');
                    contents.removeClass('active');
                    tab.addClass('active');
                    html.find(`.mcs-dialog-tab-content[data-tab="${tab.data('tab')}"]`).addClass('active');
                });
            }
       }, {
            classes: ["dialog", "mcs-specialty-selection-dialog"],
            width: 800, height: 600, resizable: true
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
    }/**
 * 방어 특기의 총비용을 계산하고 사용자에게 확인받아 자원을 소비합니다.
 * @param {object} totalCost - {fp, hp, en, bullets, effects, limits} 형태의 비용 객체
 * @param {Actor} defender - 방어자 액터
 * @param {Array} selectedSpecialties - 선택된 특기/아이템 목록
 * @returns {Promise<boolean>} 비용 처리가 성공적으로 완료되었는지 여부
 */
static async _handleSpecialtyCost(totalCost, defender, selectedSpecialties) {
    // =======================================================================
    // 1. HTML 컨텐츠 생성 (스타일링은 CSS 클래스로 분리)
    // =======================================================================
    const costItems = [
        { key: 'fp', label: 'FP', value: totalCost.fp },
        { key: 'hp', label: 'HP', value: totalCost.hp },
        { key: 'en', label: 'EN', value: totalCost.en },
        { key: 'bullets', label: '탄수', value: totalCost.bullets },
    ].filter(item => item.value > 0)
     .map(item => `
        <div class="mcs-cost-item">
            <span class="mcs-cost-label ${item.key}">${item.label}</span>
            <span class="mcs-cost-value">${item.value}</span>
        </div>`
     ).join('');

    const effectItems = totalCost.effects.length > 0
        ? `<div class="mcs-cost-item">
               <span class="mcs-cost-label effect">효과</span>
               <span class="mcs-cost-value">${totalCost.effects.join(", ")}</span>
           </div>`
        : '';

    // 사용 횟수 제한 항목 로직 (원본과 100% 동일)
    const limitItems = totalCost.limits?.length > 0
        ? `<div class="mcs-cost-limit-section">
               ${totalCost.limits.map(limit => `
                   <div class="mcs-cost-limit-item">
                       <input type="checkbox" id="limit_${limit.id}" name="consumeLimit" data-specialty-id="${limit.id}" checked>
                       <label for="limit_${limit.id}">${limit.name?.replace('$', '')} 사용횟수 소비</label>
                       <span class="mcs-cost-limit-value">현재: ${limit.currentLimit}회</span>
                   </div>
               `).join('')}
           </div>`
        : '';

    const content = `
        <div class="mcs-cost-dialog-wrapper">
            <div class="mcs-cost-list">${costItems}${effectItems}</div>
            ${limitItems}
        </div>`;

    // =======================================================================
    // 2. 다이얼로그 렌더링 및 콜백 (기능 로직 - 원본과 100% 동일)
    // =======================================================================
    return new Promise((resolve) => {
        new Dialog({
            title: "방어 특기 비용 소비 확인",
            content: content,
            buttons: {
                confirm: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "소비",
                    callback: async (html) => {
                        try {
                            // 이하는 자원 소비 로직으로, 원본 코드와 100% 동일합니다.
                            if (totalCost.limits?.length > 0) {
                                const checkedLimits = html.find('input[name="consumeLimit"]:checked').map((i, el) => $(el).data('specialty-id')).get();
                                for (const specialtyId of checkedLimits) {
                                    const limitInfo = totalCost.limits.find(l => l.id === specialtyId);
                                    if (limitInfo && limitInfo.item) {
                                        if (limitInfo.currentLimit <= 0) {
                                            ui.notifications.warn(`${limitInfo.name} 특기의 사용횟수가 부족합니다!`);
                                            return resolve(false);
                                        }
                                        await limitInfo.item.update({ "system.props.limit": limitInfo.currentLimit - 1 });
                                    }
                                }
                            }
                            if (totalCost.fp > 0) await defender.update({ "system.props.fpvalue": defender.system.props.fpvalue - totalCost.fp });
                            if (totalCost.hp > 0) await defender.update({ "system.props.hpvalue": defender.system.props.hpvalue - totalCost.hp });
                            if (totalCost.en > 0) await defender.update({ "system.props.envalue": defender.system.props.envalue - totalCost.en });
                            if (totalCost.bullets > 0) {
                                for (const specialty of totalCost.limits) {
                                    if (specialty.item) {
                                        const currentBullets = specialty.item.system.props.bullets || 0;
                                        if (currentBullets >= totalCost.bullets) {
                                            await specialty.item.update({ "system.props.bullets": currentBullets - totalCost.bullets });
                                            break;
                                        }
                                    }
                                }
                            }
                            for (let effect of totalCost.effects) {
                                if (effect) {
                                    let token = canvas.tokens.controlled[0] || canvas.tokens.placeables.find(t => t.actor?.id === defender.id);
                                    if (token) {
                                        await this._applyEffect(token, effect);
                                    } else {
                                        ui.notifications.warn(`${effect} 상태를 적용할 토큰을 찾을 수 없습니다.`);
                                    }
                                }
                            }
                            resolve(true);
                        } catch (error) {
                            console.error("방어 특기 비용 처리 중 오류 발생:", error);
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
        }, {
            classes: ["dialog", "mcs-cost-dialog"]
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

/**
 * 주사위 한 개의 HTML을 생성합니다. (리팩토링 완료)
 * @param {number|string} result - 주사위 눈
 * @returns {string} HTML 문자열
 */
static _getDiceHtml(result) {
    return `<div class="roll die mcs-die">${result}</div>`;
}
/**
 * 방어 굴림의 최종 결과를 보여주는 HTML을 생성합니다.
 * @param {object} params - 방어 결과에 필요한 모든 파라미터 객체
 * @returns {string} HTML 문자열
 */
static _getDefenseResultHtml(params) {
    const {
        defender, defenderToken, defenseOption, defenseType, defenseValue,
        fixedDefenseRoll, modifierText, diceBonus, roll, diceResults,
        attackRoll, success, margin, isDefenseFumble, isDefenseCritical,
        isAttackFumble, isAttackCritical, getResultText, damageContent,
        attackerStats = { baseAttack: 0, attackType: 'hit' },
        selectedSpecialties = [], combatDataStr
    } = params;

    // 사용된 특기 목록 HTML 생성
    const specialtiesHtml = selectedSpecialties?.length > 0
        ? `<div class="mcs-collapsible-card mcs-subsection collapsed">
               <div class="mcs-collapsible-header mcs-subsection-header">
                   <div class="mcs-subsection-title">
                       <i class="fas fa-chevron-down mcs-collapse-icon"></i>
                       <strong>사용된 방어 특기</strong>
                   </div>
                   <span class="mcs-tag mcs-tag-grey">${selectedSpecialties.length}개</span>
               </div>
               <div class="mcs-collapsible-content mcs-subsection-content">
                   ${selectedSpecialties.map(specialty => this._getSpecialtyButtonHtml(specialty)).join('')}
               </div>
           </div>`
        : '';

    // 최종 결과 텍스트 및 클래스 결정
    const resultText = success ? `회피! (차이: ${margin})` : `명중! (차이: ${margin})`;
    const resultClass = success ? 'success' : 'failure';

    // 크리티컬/펌블 뱃지 HTML 생성
    const critFumbleBanner = (isDefenseFumble || isDefenseCritical || isAttackFumble || isAttackCritical)
        ? `<div class="mcs-crit-fumble-banner ${isDefenseFumble || isAttackCritical ? 'fumble' : 'critical'}">
               ${getResultText()}
           </div>`
        : '';
        
    return `
        <div class="mcs-card-wrapper mcs-collapsible-card defense-result collapsed"
             data-target-id="${defenderToken?.id || defender.id}"
             data-actor-id="${defender.id}"
             data-attack-roll="${attackRoll}"
             data-is-critical="${isAttackCritical}"
             data-is-fumble="${isAttackFumble}"
             data-combat-data="${combatDataStr}"
             data-defense-type="${defenseType}">
            
            <div class="mcs-card-header mcs-collapsible-header">
                <div class="mcs-card-header-main">
                    <i class="fas fa-chevron-down mcs-collapse-icon"></i>
                    <h3 class="mcs-card-title">${defender.name}의 ${defenseOption.label}</h3>
                </div>
                <div class="mcs-comparison-tag">
                    <span>${this.ATTACK_TYPE_LABELS[attackerStats.attackType] || attackerStats.attackType}[${attackerStats.baseAttack}]</span>
                    <strong class="attack">${attackRoll}</strong>
                    <span class="vs">vs</span>
                    <span>${defenseOption.label}[${defenseValue}]</span>
                    <strong class="defense">${roll.total}</strong>
                </div>
            </div>

            <div class="mcs-collapsible-content">
                <div class="mcs-card-content">
                    <div class="mcs-roll-formula">2d6${diceBonus > 0 ? ` + ${diceBonus}d6` : ''} + ${defenseValue}${modifierText}</div>
                    <div class="mcs-roll-result">
                        <div class="mcs-dice-tray">
                            ${(params.baseDiceResults ? params.baseDiceResults.map(die => `<div class="roll die mcs-die">${die.result}</div>`) : roll.terms.filter(t => t.faces === 6).flatMap(t => t.results).map(r => `<div class="roll die mcs-die">${r.result}</div>`)).join('')}
                        </div>
                        <div class="mcs-roll-total">
                            ${roll.total}
                            ${fixedDefenseRoll !== null ? '<i class="fas fa-edit mcs-icon-small" title="수정된 값"></i>' : ''}
                        </div>
                    </div>

                    ${specialtiesHtml}
                    ${critFumbleBanner}

                    <div class="mcs-final-result ${resultClass}">${resultText}</div>
                </div>
                ${damageContent || ''}
            </div>
        </div>
    `;
}

/**
 * 데미지 굴림을 계산하고 그 결과를 표시하는 HTML 컨텐츠를 생성합니다.
 * @param {object} weaponData - 무기 정보
 * @returns {Promise<string>} HTML 문자열
 */
static async _calculateDamageContent(weaponData) {
    if (!weaponData) return '';

    // =======================================================================
    // 1. 룰 로직: 데미지 공식 계산 (원본과 100% 동일, 중복된 atk 추가 로직 수정)
    // =======================================================================
    let formulaParts = ['2d6'];

    // 기본 대미지
    if (weaponData.weaponfinaldmg && weaponData.weaponfinaldmg !== '0') {
        formulaParts.push(weaponData.weaponfinaldmg.replace('$', ''));
    }
    // 공격력
    if (weaponData.atk && weaponData.atk !== '0') {
        formulaParts.push(weaponData.atk.replace('$', ''));
    }
    // 주사위 보너스
    if (weaponData.dmgdiebonus && weaponData.dmgdiebonus !== '0') {
        formulaParts.push(`${weaponData.dmgdiebonus.replace('$', '')}d6`);
    }
    // 수치 보너스
    if (weaponData.dmgnumbonus && weaponData.dmgnumbonus !== '0') {
        formulaParts.push(weaponData.dmgnumbonus.replace('$', ''));
    }
    const damageFormula = formulaParts.join(' + ');

    // =======================================================================
    // 2. 굴림 실행 및 HTML 생성 (스타일링 분리)
    // =======================================================================
    try {
        const damageRoll = new Roll(damageFormula);
        await damageRoll.evaluate({ async: true });

        if (game.dice3d) {
            await game.dice3d.showForRoll(damageRoll, game.user, true);
        }

        const damageDiceResults = damageRoll.dice.flatMap(d => d.results).map(r => `<div class="roll die mcs-die">${r.result}</div>`).join('');

        return `
            <div class="mcs-damage-section">
                <div class="mcs-card-header">
                    <h3 class="mcs-card-title">${weaponData.name.replace('$', '')} - 데미지</h3>
                    <span class="mcs-tag mcs-tag-grey">${weaponData.weapontype.replace('$', '')}</span>
                </div>
                <div class="mcs-card-content">
                    <div class="mcs-roll-formula">${damageFormula}</div>
                    <div class="mcs-roll-result">
                        <div class="mcs-dice-tray">${damageDiceResults}</div>
                        <div class="mcs-roll-total damage">${damageRoll.total}</div>
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

