import { DiceHelper } from '../utils/dice.js';
import { DefenseManager } from './defense.js';
import { WeaponEffects } from '../effects/weaponEffects.js';

export class CombatManager {

    static ATTACK_OPTIONS = {
        hit: { prop: "hit", label: "명중", shortLabel: "명중" },
        evasion: { prop: "evasion", label: "회피", shortLabel: "회피" },
        pro: { prop: "pro", label: "방벽", shortLabel: "방벽" },
        init: { prop: "init", label: "행동", shortLabel: "행동" },
        shelling: { prop: "shelling", label: "포격", shortLabel: "포격" }
    };

    static initialize(socketlib) {
        console.log('[CombatManager] Initializing with socketlib:', socketlib);
        if (!socketlib) {
            console.error('[CombatManager] No socketlib provided');
            return false;
        }

        try {
            this.socket = socketlib;

            // 실제로 있는 메서드들만 등록
            this.socket.register('performMultiAttack', this.performMultiAttack.bind(this));
            this.socket.register('performSimpleAttack', this.performSimpleAttack.bind(this));
            this.socket.register('calculateFinalDamage', this.calculateFinalDamage.bind(this));
            this.socket.register('showDamageDialog', this.showDamageDialog.bind(this));

            console.log('[CombatManager] Successfully initialized');
            return true;
        } catch (error) {
            console.error('[CombatManager] Error during initialization:', error);
            return false;
        }
    }

    static _determineAttackType(part) {
        if (!part) return 'hit';
        const partLower = part.toLowerCase();
        
        if (partLower.includes('원격의 주무장') || partLower.includes('원격의 부무장')) {
            return 'shelling';
        }
        return 'hit';  // 백병의 주무장, 백병의 부무장인 경우
    }

    static async performMultiAttack(attackerIds, targetIds, userSelectedAttackType, modifier = 0, weaponCrit = null, atkcritMod = '0', attackPart = '', attackerItem = null, selectedSpecialties = [], fixedRoll = null, originalDiceResults) {
        console.log('[performMultiAttack] Starting with params:', {
            attackerIds,
            targetIds,
            userSelectedAttackType,
            modifier,
            weaponCrit,
            atkcritMod,
            attackPart,
            attackerItem,
            selectedSpecialties
        });

        // 사용자가 선택한 타입이 있으면 그것을 사용, 없으면 부위에 따라 자동 결정
        const attackType = userSelectedAttackType || this._determineAttackType(attackPart);
        console.log('[performMultiAttack] Using attack type:', attackType);

        if (!attackerItem) {
            console.error('[performMultiAttack] No weapon data provided');
            return null;
        }

        let critModifier;
        try {
            critModifier = atkcritMod === 'ERROR' ? 0 : Number(atkcritMod) || 0;
        } catch (error) {
            console.error('[performMultiAttack] Error processing critModifier:', error);
            critModifier = 0;
        }
        console.log('Critical modifier:', critModifier);

        const results = [];
        const attackOption = this.ATTACK_OPTIONS[attackType];
        if (!attackOption) {
            console.error('[performMultiAttack] Invalid attack type:', attackType);
            return null;
        }

        // 공격자 정보 가져오기
        const attackerId = attackerIds[0]; // 첫 번째 공격자만 사용
        const attackerToken = canvas.tokens.placeables.find(t => t.id === attackerId);
        const attacker = attackerToken ? attackerToken.actor : game.actors.get(attackerId);

        if (!attacker) {
            console.error('[performMultiAttack] Attacker not found:', attackerId);
            return null;
        }

        // 하나의 공격 굴림만 수행
        const diceBonus = DiceHelper.safeParseInt(attacker.system.props.atkdiebonus, 0);
        const numBonus = DiceHelper.safeParseInt(attacker.system.props.atknumbonus, 0);
        const attackValue = DiceHelper.safeParseInt(attacker.system.props[attackOption.prop]);
        const totalAttack = attackValue + Number(modifier) + numBonus;

        let attackRoll;
        let baseDiceResults;
        let baseDiceTotal;
    
        if (fixedRoll !== null) {
            
            const diceFormula = `2d6${diceBonus > 0 ? ` + ${diceBonus}d6` : ''}+${totalAttack}`;
            let originalRoll;
            
            if (originalDiceResults) {
                originalRoll = new Roll(diceFormula);
                await originalRoll.evaluate();
                originalRoll.terms[0].results = originalDiceResults;
            } else {
                originalRoll = new Roll(diceFormula);
                await originalRoll.evaluate();
            }
        
            // 기존 주사위 결과 유지
            baseDiceResults = originalRoll.terms[0].results;
            baseDiceTotal = baseDiceResults.reduce((sum, die) => sum + die.result, 0);
        
            // 새로운 Roll 객체를 올바른 방식으로 생성
            attackRoll = await Roll.create(diceFormula);
            await attackRoll.evaluate();
        
            // 원본의 terms와 results 복사 - 여기는 원본 코드 그대로 유지
            attackRoll.terms = originalRoll.terms;
            
            // 수정치를 적용한 최종 결과 설정
            Object.defineProperty(attackRoll, '_total', {
                value: fixedRoll,
                configurable: true,
                enumerable: true
            });
        } else {
            // 기존 주사위 굴림 코드
            const diceFormula = `2d6${diceBonus > 0 ? ` + ${diceBonus}d6` : ''}+${totalAttack}`;
            attackRoll = new Roll(diceFormula);
            await attackRoll.evaluate();
            baseDiceResults = attackRoll.terms[0].results;
            baseDiceTotal = baseDiceResults.reduce((sum, die) => sum + die.result, 0);
        }
        

        // 펌블 체크
        const pumbleThreshold = DiceHelper.safeParseInt(attacker.system.props.pumble, 2);
        const pumbleMod = DiceHelper.safeParseInt(attacker.system.props.pumblemod, 0);
        const adjustedPumbleThreshold = Math.max(2, pumbleThreshold + pumbleMod);
        const isFumble = fixedRoll === null ? baseDiceTotal <= adjustedPumbleThreshold : false;

        // 크리티컬 체크
        const criticalThreshold = DiceHelper.safeParseInt(weaponCrit, 0);
        const adjustedCritThreshold = criticalThreshold + critModifier;
        const isCritical = fixedRoll === null ? (criticalThreshold > 0 && baseDiceTotal >= adjustedCritThreshold) : false;

        // 각 타겟에 대한 정보 수집
        const targets = targetIds.map(targetId => {
            const targetToken = canvas.tokens.placeables.find(t => t.id === targetId);
            const target = targetToken ? targetToken.actor : game.actors.get(targetId);

            return {
                token: targetToken,
                actor: target
            };
        }).filter(t => t.actor); // 유효한 타겟만 필터링

        const attackerResults = {
            attacker,
            attackerToken,
            attackOption,
            item: attackerItem,
            roll: attackRoll,
            baseValue: attackValue,
            diceBonus,
            numBonus,
            totalMod: numBonus + Number(modifier),
            isCritical,
            isFumble,
            criticalThreshold: adjustedCritThreshold,
            pumbleThreshold: adjustedPumbleThreshold,
            baseDiceTotal,
            selectedSpecialties: selectedSpecialties || [],
            targets: targets.map(t => ({
                target: t.actor,
                targetToken: t.token,
                roll: attackRoll,
                baseValue: attackValue,
                diceBonus,
                numBonus,
                totalMod: numBonus + Number(modifier),
                isCritical,
                isFumble,
                criticalThreshold: adjustedCritThreshold,
                pumbleThreshold: adjustedPumbleThreshold,
                baseDiceTotal
            }))
        };

        results.push(attackerResults);

        // 무기 효과 재생
        window.pendingWeaponEffect = async () => {
            const targets = targetIds.map(targetId => {
                const targetToken = canvas.tokens.placeables.find(t => t.id === targetId);
                return targetToken;
            }).filter(t => t);

            if (attackerToken && targets.length > 0) {
                try {
                    const weaponFx = attackerItem.weaponfx || '기본';
                    const success = !isFumble;

                    if (game.modules.get('sequencer')?.active) {
                        await WeaponEffects.playWeaponEffect(
                            attackerToken,
                            targets,
                            weaponFx,
                            success
                        );
                    }
                } catch (error) {
                    console.error("Error playing weapon effect:", error);
                }
            }
        };

        const chatData = {
            author: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            content: this._getMultiAttackMessageContent(results, modifier, [attackRoll], attackPart, attackOption, attackType, attacker, attackerItem, critModifier, fixedRoll),
            type: CONST.CHAT_MESSAGE_STYLES.ROLL,
            rolls: [attackRoll]
        };

        await ChatMessage.create(chatData);
        return results;
    }

    static async performSimpleAttack(attackerIds, attackType, modifier = 0) {
        console.log('[performSimpleAttack] Starting with params:', {
            attackerIds,
            attackType,
            modifier
        });

        const results = [];
        const rolls = [];

        const attackOption = this.ATTACK_OPTIONS[attackType];
        if (!attackOption) {
            console.error('[performSimpleAttack] Invalid attack type:', attackType);
            return null;
        }

        for (const attackerId of attackerIds) {
            const attackerToken = canvas.tokens.placeables.find(t => t.id === attackerId);
            const attacker = attackerToken ? attackerToken.actor : game.actors.get(attackerId);

            if (!attacker) {
                console.error('[performSimpleAttack] Attacker not found:', attackerId);
                continue;
            }

            const diceBonus = DiceHelper.safeParseInt(attacker.system.props.atkdiebonus, 0);
            const numBonus = DiceHelper.safeParseInt(attacker.system.props.atknumbonus, 0);

            const attackValue = DiceHelper.safeParseInt(attacker.system.props[attackOption.prop]);
            const totalAttack = attackValue + Number(modifier) + numBonus;

            const diceFormula = `2d6${diceBonus > 0 ? ` + ${diceBonus}d6` : ''}+${totalAttack}`;
            console.log('[performSimpleAttack] Attack formula:', diceFormula);

            const attackRoll = new Roll(diceFormula);
            await attackRoll.evaluate();

            rolls.push(attackRoll);
            results.push({
                attacker,
                attackerToken,
                roll: attackRoll,
                baseValue: attackValue,
                diceBonus,
                numBonus,
                totalMod: numBonus + Number(modifier),
                abilityType: attackType // 능력치 타입 추가
            });
        }

        console.log('[performSimpleAttack] Creating attack message');
        await this.createSimpleAttackMessage(results, modifier, rolls);
        return results;
    }

    static _getSimpleAttackMessageContent(results, modifier) {
        // 능력치 표시를 위한 매핑
        const ABILITY_LABELS = {
            hit: "명중",
            shelling: "포격",
            evasion: "회피",
            pro: "방벽",
            init: "행동"
        };

        let content = `<div class="mcs-card"><div class="diceroll simple-attack-roll">`;

        for (const result of results) {
            const { attacker, roll, baseValue, diceBonus, numBonus, abilityType } = result;
            const abilityLabel = ABILITY_LABELS[abilityType] || abilityType;

            let modDescription = [];
            if (numBonus !== 0) modDescription.push(`캐릭터 보너스: ${numBonus >= 0 ? '+' : ''}${numBonus}`);
            if (modifier !== 0) modDescription.push(`상황 수정치: ${modifier >= 0 ? '+' : ''}${modifier}`);
            const modifierText = modDescription.length > 0 ? ` (${modDescription.join(', ')})` : '';

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

            content += `
                <div class="attack-message" style="
                    background: #f0f0f0;
                    border-radius: 10px;
                    padding: 8px;
                    margin-bottom: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    
                    <div class="attacker-header" style="
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
                            ${attacker.name}의 ${abilityLabel} 판정
                        </h3>
                        <span style="
                            background: #e9ecef;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #4a4a4a;">
                            ${baseValue}
                        </span>
                    </div>

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
                                2d6${diceBonus > 0 ? ` + ${diceBonus}d6` : ''} + ${baseValue}${modifierText}
                            </span>
                        </div>

                        <div style="
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
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
                                border-radius: 4px;">
                                ${roll.total}
                            </span>
                        </div>
                    </div>
                </div>`;
        }
        content += '</div>';

        return content;
    }

    static async createSimpleAttackMessage(results, modifier, rolls) {
        console.log('[createSimpleAttackMessage] Creating message with:', {
            resultsCount: results.length,
            modifier,
            rollsCount: rolls.length
        });

        const chatData = {
            author: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            content: this._getSimpleAttackMessageContent(results, modifier),
            type: CONST.CHAT_MESSAGE_STYLES.ROLL,
            rolls: rolls
        };

        return ChatMessage.create(chatData);
    }

    static _getMultiAttackMessageContent(results, modifier, rolls, attackPart, attackOption, attackType, attacker, attackerItem, critModifier, fixedRoll) {
        console.log("크리 수정치:", {
            results
    });
    let content = `<div class="mcs-card">
<style>
    .collapsible-header {
        cursor: pointer;
        user-select: none;
    }
    .collapsible-header:hover {
        background-color: rgba(0,0,0,0.05);
    }
    .collapsible-content {
        display: block;
        transition: all 0.3s ease-out;
        opacity: 1;
        height: auto;
        overflow: hidden;
        visibility: visible;
        position: relative;
    }
    .collapsed .collapsible-content {
        display: block !important;
        height: 0 !important;
        opacity: 0 !important;
        margin: 0 !important;
        padding: 0 !important;
        visibility: hidden !important;
        position: absolute !important;
        pointer-events: none !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
    }
    .collapse-icon {
        transition: transform 0.3s ease;
    }
    .collapsed .collapse-icon {
        transform: rotate(-90deg);
    }

    /* 접근성을 위한 숨김 처리 추가 */
    .collapsed .collapsible-content > * {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        padding: 0 !important;
        margin: -1px !important;
        overflow: hidden !important;
        clip: rect(0,0,0,0) !important;
        white-space: nowrap !important;
        border: 0 !important;
    }
</style>
        <div class="diceroll multi-attack-roll">`;

        for (const attackerResult of results) {
            const attacker = attackerResult.attacker;
            const attackerItem = attackerResult.item;
            const targets = attackerResult.targets;

            console.error('[performMultiAttack] 어택커 아이템:', attackerItem);
    
            // weaponItem 찾기를 여기로 이동
            const weaponItem = attacker?.items
                ?.filter(item => 
                    item.system?.props?.type === "weapon" &&
                    item.system?.props?.name === attackerItem?.name?.replace(/\$/g, '')
                )[0];
    
                const specialTags = [];
                if (weaponItem?.system?.props?.sniping) {
                    specialTags.push(`
                        <span style="
                            background: #f0f0f0;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #666;
                            border: 1px solid #ddd;">
                            저격
                        </span>`);
                }
                if (weaponItem?.system?.props?.armorignore) {
                    specialTags.push(`
                        <span style="
                            background: #f0f0f0;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #666;
                            border: 1px solid #ddd;">
                            방어관통
                        </span>`);
                }
                if (weaponItem?.system?.props?.PK) {
                    specialTags.push(`
                        <span style="
                            background: #f0f0f0;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #666;
                            border: 1px solid #ddd;">
                            염동
                        </span>`);
                }
                if (weaponItem?.system?.props?.jump) {
                    specialTags.push(`
                        <span style="
                            background: #f0f0f0;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #666;
                            border: 1px solid #ddd;">
                            도약
                        </span>`);
                }
                if (weaponItem?.system?.props?.transition) {
                    specialTags.push(`
                        <span style="
                            background: #f0f0f0;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #666;
                            border: 1px solid #ddd;">
                            전이
                        </span>`);
                }
                if (weaponItem?.system?.props?.awakening) {
                    specialTags.push(`
                        <span style="
                            background: #f0f0f0;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #666;
                            border: 1px solid #ddd;">
                            각성
                        </span>`);
                }
                if (weaponItem?.system?.props?.ASW) {
                    specialTags.push(`
                        <span style="
                            background: #f0f0f0;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #666;
                            border: 1px solid #ddd;">
                            대잠
                        </span>`);
                }

            content += `
            <div class="attack-message collapsible-card" 
                data-attacker-id="${attacker.id}"
                data-weapon-name="${attackerItem.name}"
                data-weapon-kind="${attackerItem.weaponkind}"
                data-attack-type="${attackType}"
                data-modifier="${modifier}"
                data-weapon-crit="${attackerItem.weaponcrit}"
                data-weapon-type="${attackerItem.weapontype}"
                data-weapon-range="${attackerItem.weaponrange}"
                data-weapon-cost="${attackerItem.weaponcost}"
                data-weapon-final-dmg="${attackerItem.weaponfinaldmg}"
                data-weapon-side-dmg="${attackerItem.sidedamage}"
                data-weapon-effect="${encodeURIComponent(attackerItem.weaponeffect)}"
                data-attacker-item-part="${attackerItem.part}"
                data-attacker-item-atk="${attackerItem.atk}"
                data-weapon-target="${attackerItem.weapontarget}"
            style="
                background: #f0f0f0;
                border-radius: 10px;
                padding: 8px;
                margin-bottom: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                
                <div class="collapsible-header" style="
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    background: white;
                    padding: 8px 12px;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                    
                    <div style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;">
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 8px;">
                            <i class="fas fa-chevron-down collapse-icon" style="
                                color: #4a4a4a;
                                transition: transform 0.3s ease;"></i>
                            <h3 style="
                                margin: 0;
                                font-size: var(--font-size-14);
                                color: #4a4a4a;">
                                ${attacker.name}의 ${attackerItem.name}
                            </h3>
                        </div>
                        <div style="
                            background: #e9ecef;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: var(--font-size-12);
                            color: #4a4a4a;">
                            크리티컬: ${Math.max(2, parseInt(attackerItem.weaponcrit.replace('$', '')) + critModifier)}
                        </div>
                    </div>
                    
                        <div style="
                            display: flex;
                            flex-wrap: wrap;
                            gap: 6px;
                            overflow-x: auto;
                            white-space: nowrap;
                            scrollbar-width: none; 
                            -ms-overflow-style: none; 
                            padding-bottom: 4px;"> 
                            <span style="
                                flex-shrink: 0;
                                background: #f8f9fa;
                                padding: 2px 6px;
                                border-radius: 4px;
                                font-size: var(--font-size-12);
                                color: #666;">
                                ${attackerItem.part.replace('$', '')}
                            </span>
                            <span style="
                                flex-shrink: 0;
                                background: #f8f9fa;
                                padding: 2px 6px;
                                border-radius: 4px;
                                font-size: var(--font-size-12);
                                color: #666;">
                                ${attackerItem.weapontype.replace('$', '')}
                            </span>
                            <span style="
                                flex-shrink: 0;
                                background: #f8f9fa;
                                padding: 2px 6px;
                                border-radius: 4px;
                                font-size: var(--font-size-12);
                                color: #666;">
                                ${attackerItem.weaponkind.replace('$', '')}
                            </span>                            
                            <span style="
                                flex-shrink: 0;
                                background: #f8f9fa;
                                padding: 2px 6px;
                                border-radius: 4px;
                                font-size: var(--font-size-12);
                                color: #666;">
                                ${attackerItem.weaponrange.replace('$', '')}${attackerItem.weapontarget ?
                                    ` / ${attackerItem.weapontarget.replace('$', '')}` : ''}
                            </span>
                            ${attackerItem.weaponcost ? `
                                <span style="
                                    flex-shrink: 0;
                                    background: #f8f9fa;
                                    padding: 2px 6px;
                                    border-radius: 4px;
                                    font-size: var(--font-size-12);
                                    color: #666;">
                                    ${attackerItem.weaponcost.replace('$', '')}
                                </span>
                            ` : ''}
                        </div>
                        <style>
                            div::-webkit-scrollbar {
                                display: none;
                            }
                        </style>
                        
                    ${specialTags.length > 0 ? `
                        <div style="
                            display: flex;
                            flex-wrap: wrap;
                            gap: 4px;
                            padding-top: 4px;
                            border-top: 1px solid #eee;">
                            ${specialTags.join('')}
                        </div>
                    ` : ''}
                </div>
        
                <div class="collapsible-content">
                ${attackerItem.weaponeffect ? `
                    <div class="collapsible-card collapsed" style="
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
                                <strong style="color: #666;">무기 효과</strong>
                            </div>
                        </div>
                
                        <div class="collapsible-content" style="
                            padding: 6px 10px;">
                            ${attackerItem.weaponeffect.replace('$', '')}
                        </div>
                    </div>
                ` : ''}
        
                    ${attackerResult?.selectedSpecialties?.length > 0 ? `
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
                                    <strong style="color: #666;">사용된 특기/아이템</strong>
                                </div>
                                <span style="
                                    background: #e9ecef;
                                    padding: 2px 6px;
                                    border-radius: 4px;
                                    font-size: var(--font-size-12);
                                    color: #666;">
                                    ${attackerResult.selectedSpecialties.length}개
                                </span>
                            </div>
                    
                            <div class="collapsible-content" style="padding: 0 10px 10px 10px;">
                                ${attackerResult.selectedSpecialties.map(specialty => `
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
    
                    <div class="collapsible-content">
        ${attackerResult.targets.map(targetResult => {
            const { target, roll, diceBonus, numBonus, totalMod, baseValue,
                isCritical, criticalThreshold, isFumble, baseDiceTotal, pumbleThreshold,
                existingDefenseContent } = targetResult;

                console.log('Processing target for content:', {
                    targetId: target.id,
                    hasExistingDefense: !!existingDefenseContent
                });

            let modDescription = [];
            if (numBonus !== 0) modDescription.push(`캐릭터 보너스: ${numBonus >= 0 ? '+' : ''}${numBonus}`);
            if (modifier !== 0) modDescription.push(`상황 수정치: ${modifier >= 0 ? '+' : ''}${modifier}`);
            const modifierText = modDescription.length > 0 ? ` (${modDescription.join(', ')})` : '';

            // 주사위 결과 HTML 생성
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

                let defenseSection;
                if (targetResult.existingDefenseContent) {
                    console.log('Using existing defense content');
                    defenseSection = `<div class="defense-controls">${targetResult.existingDefenseContent}</div>`;
                } else {
                    console.log('Creating new defense controls');
                    defenseSection = this._getDefenseControlsHtml(target, targetResult.targetToken, roll.total,
                        isCritical, isFumble, attackPart, attackerItem, attacker,
                        attackerResult.attackerToken, attackType);
                }
        
            console.log('Defense section check:', {
                hasExisting: !!targetResult.existingDefenseContent,
                contentPreview: (targetResult.existingDefenseContent || '').substring(0, 50)
            });

                        return `
            <div class="target-section collapsible-card" 
                data-target-id="${targetResult.targetToken?.id || targetResult.target.id}"
                data-actor-id="${targetResult.target.id}"
                data-attack-roll="${roll.total}"
                data-is-critical="${isCritical}"
                data-is-fumble="${isFumble}"
                data-base-value="${baseValue}"
                data-dice-bonus="${diceBonus}"
                data-num-bonus="${numBonus}"
                data-total-mod="${totalMod}"
                data-base-dice-total="${baseDiceTotal}"
                data-critical-threshold="${criticalThreshold}"
                data-pumble-threshold="${pumbleThreshold}"
                data-combat-data="${encodeURIComponent(JSON.stringify({
                    attacker: {
                        id: attacker.id,
                        name: attacker.name,
                        baseAttack: baseValue,
                        attackType: attackType
                    },
                    weapon: {
                        name: attackerItem.name,
                        weapontype: attackerItem.weapontype,
                        weaponfinaldmg: attackerItem.weaponfinaldmg,
                        sidedamage: attackerItem.sidedamage,
                        weaponfx: attackerItem.weaponfx,
                        part: attackerItem.part,
                        atk: attackerItem.atk,
                        sniping: attackerItem.sniping,
                        armorignore: attackerItem.armorignore
                    }
                }))}"
            style="
                background: white;
                border-radius: 8px;
                padding: 8px;
                margin-top: 6px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                
            <div class="collapsible-header" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 4px;">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 8px;">
                    <span style="
                        font-size: var(--font-size-12);
                        color: #666;
                        white-space: nowrap;">
                        대상:
                    </span>
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 8px;">
                        <img src="${target.img || 'icons/svg/mystery-man.svg'}" 
                            alt="${target.name}" 
                            style="
                                width: 36px;
                                height: 36px;
                                border-radius: 50%;
                                object-fit: cover;
                                border: 2px solid #ddd;
                                box-shadow: 0 2px 4px rgba(0,0,0,0.1);"
                            onerror="this.src='icons/svg/mystery-man.svg'">
                        <span style="
                            font-size: var(--font-size-14);
                            color: #4a4a4a;
                            font-weight: bold;">
                            ${target.name}
                        </span>
                    </div>
                </div>
                <span style="
                    font-size: var(--font-size-12);
                    color: #666;">
                    2d6${diceBonus > 0 ? ` + ${diceBonus}d6` : ''} + ${baseValue}${modifierText}
                </span>
            </div>

            <div style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                background: #f8f9fa;
                border-radius: 6px;
                padding: 4px 8px;">
            <div style="display: flex; gap: 4px;">
                ${diceResults}
            </div>
        ${fixedRoll !== null ? `
            <div style="
                font-size: var(--font-size-16);
                font-weight: bold;
                padding: 2px 8px;
                background: #4a4a4a;
                color: white;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 6px;">
                <span style="font-size: var(--font-size-12);">${attackOption.label}[${baseValue}]</span>
                <span>${roll.total}</span>
                <i class="fas fa-edit" style="font-size: 12px;" title="수정된 값"></i>
            </div>
        ` : `
            <div style="    
                font-size: var(--font-size-16);
                font-weight: bold;
                padding: 2px 8px;
                background: #4a4a4a;
                color: white;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 6px;">
                <span style="font-size: var(--font-size-12);">${attackOption.label}[${baseValue}]</span>
                <span>${roll.total}</span>
            </div>            
            `}
        </div>
                                        
        ${(isFumble || isCritical) ? `
        <div style="
            background: ${isFumble ? '#dc3545' : '#28a745'};
            color: white;
            padding: 4px;
            border-radius: 4px;
            margin-top: 4px;
            text-align: center;
            font-size: var(--font-size-12);
            font-weight: bold;">
            ${isFumble ?
            `펌블! (2d6: ${baseDiceTotal} ≤ ${pumbleThreshold})` :
            `크리티컬! (2d6: ${baseDiceTotal} ≥ ${criticalThreshold})`}
        </div>
                ` : ''}
                                        
        ${isFumble ? `
        <div style="
            color: #dc3545;
            text-align: center;
            margin-top: 4px;
            font-size: var(--font-size-12);
            font-weight: bold;">
            자동 실패!
        </div>
                ` : ''}
                                        
                    ${defenseSection}
                </div>
            `;
                        }).join('')}
            </div>
        </div>`;
            }

        content += '</div></div>';        
        return content;
    }

    static async calculateFinalDamage(weaponData, successfulHits) {
        if (!game.user.isGM) return;
        console.log("Weapon Data:", weaponData);

        let formulaParts = ['2d6'];
    
        const isPart = weaponData.part?.toLowerCase();
        const isSubWeapon = isPart?.includes('부무장');
    
        // 기본 대미지 추가 - 부무장이면 sidedamage 사용
        if (isSubWeapon) {
            if (weaponData.sidedamage && weaponData.sidedamage !== '0') {
                formulaParts.push(weaponData.sidedamage.replace('$', ''));
            }
        } else {
            if (weaponData.weaponfinaldmg && weaponData.weaponfinaldmg !== '0') {
                formulaParts.push(weaponData.weaponfinaldmg.replace('$', ''));
            }
        }

        // 공격력 추가
        if (weaponData.atk && weaponData.atk !== '0') {
            formulaParts.push(weaponData.atk.replace('$', ''));
        }
        console.log(weaponData.atk);

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

            // 주사위 결과 HTML 생성
            const damageDiceResults = damageRoll.dice.map(d =>
                d.results.map(r => `
                    <div class="roll die" style="
                        width: 24px;
                        height: 24px;
                        background: white;
                        border: 2px solid #ddd;
                        border-radius: 6px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        font-size: var(--font-size-12);">
                        ${r.result}
                    </div>`).join('')
            ).join('');

            // 새로운 채팅 메시지로 데미지 표시
            await ChatMessage.create({
                content: `
                    <div style="
                        background: #f0f0f0;
                        border-radius: 10px;
                        padding: 12px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                        
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
                                ${weaponData.name.replace('$', '')} - 최종 데미지
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
                                명중된 대상: ${successfulHits}
                            </div>
    
                                    <div style="
                                        display: flex;
                                        align-items: center;
                                        justify-content: space-between;
                                        background: #f8f9fa;
                                        border-radius: 6px;
                                        padding: 4px 8px;
                                        min-width: 0;"> <!-- min-width: 0 추가 -->
                                        
                                        <div style="
                                            display: flex;
                                            gap: 4px;
                                            overflow-x: auto;
                                            flex-wrap: nowrap;
                                            padding-right: 8px;">
                                            ${damageDiceResults}
                                        </div>
                                        
                                        <div style="
                                            flex-shrink: 0;
                                            font-size: var(--font-size-16);
                                            font-weight: bold;
                                            padding: 2px 8px;
                                            background: #dc3545;
                                            color: white;
                                            border-radius: 4px;
                                            white-space: nowrap;">
                                            ${damageRoll.total}
                                        </div>
                                    </div>
                                </span>
                            </div>
                        </div>
                    </div>`,
                speaker: ChatMessage.getSpeaker(),
                type: CONST.CHAT_MESSAGE_STYLES.ROLL,
                roll: damageRoll
            });

        } catch (error) {
            console.error('Error calculating final damage:', error);
            ui.notifications.error("대미지 계산 중 오류가 발생했습니다.");
        }
    }

    static async _showEffectSelectionDialog(attackerItem, attacker) {
        console.log("Actor 데이터:", attacker);
    
        // 선택 가능한 항목들을 필터링
        const selections = attacker.items
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
                    limit: item.system.props.iquantity,
                    item: item
                };
            }
        });
    
        if (!selections.length) return [];
    
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
                title: "공격 특기/아이템 선택",
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

    static _calculateEffectsCost(selectedSpecialties) {
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

    static async _handleEffectsCost(totalCost, attacker, selectedSpecialties) {
        console.log("_handleEffectsCost 시작:", {
            totalCost,
            attacker: attacker?.name,
            selectedSpecialties
        });
        return new Promise((resolve) => {
            new Dialog({
                title: "공격 특기 비용 소비 확인",
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
                                    let fpValue = attacker.system.props.fpvalue;
                                    await attacker.update({
                                        "system.props.fpvalue": fpValue - totalCost.fp
                                    });
                                }
    
                                // HP 소비
                                if (totalCost.hp > 0) {
                                    let hpValue = attacker.system.props.hpvalue;
                                    await attacker.update({
                                        "system.props.hpvalue": hpValue - totalCost.hp
                                    });
                                }
    
                                // EN 소비
                                if (totalCost.en > 0) {
                                    let enValue = attacker.system.props.envalue;
                                    await attacker.update({
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
                                            await this._applyDamageEffect(token, effect);
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

    static async _activateEffects(actor, selectedSpecialties) {
        try {
            let activeGroups = actor.system.activeConditionalModifierGroups || [];

            // 선택된 특기들에 대해
            for (const specialty of selectedSpecialties) {
                const specialtyItem = actor.items.find(i => i.name === specialty.name?.replace('$', ''));
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

            await actor.update({
                "system.activeConditionalModifierGroups": activeGroups
            });

            ui.notifications.info(`선택한 특기 효과들이 활성화되었습니다.`);
        } catch (error) {
            console.error("효과 활성화 중 오류 발생:", error);
            ui.notifications.error("효과 활성화 중 오류가 발생했습니다.");
        }
    }

    static async _deactivateEffects(actor, selectedSpecialties) {
        try {
            let activeGroups = actor.system.activeConditionalModifierGroups || [];

            // 선택된 특기들의 효과 제거
            for (const specialty of selectedSpecialties) {
                const specialtyItem = actor.items.find(i => i.name === specialty.name?.replace('$', ''));
                if (!specialtyItem) continue;

                const modifierGroups = specialtyItem.system.modifiers
                    ?.filter(m => m.conditionalGroup)
                    ?.map(m => m.conditionalGroup) || [];

                // 해당 특기의 그룹들 제거
                activeGroups = activeGroups.filter(group => !modifierGroups.includes(group));
            }

            // 업데이트
            await actor.update({
                "system.activeConditionalModifierGroups": activeGroups
            });

            ui.notifications.info("특기 효과가 종료되었습니다.");
        } catch (error) {
            console.error("효과 비활성화 중 오류 발생:", error);
        }
    }


    static _getDefenseControlsHtml(target, targetToken, attackRoll, isCritical, isFumble, attackPart = '', attackerItem = null, attacker = null, attackerToken = null, attackType, existingDefenseRoll = null) {
        if (existingDefenseRoll) {
            return existingDefenseRoll;    
        }    
    
        const targetId = targetToken?.id || target?.id;
        const actorId = target?.id || targetToken?.actor?.id;
    
        console.log("방어자 타겟 id:", targetId)
    
        if (!targetId && !actorId) {
            console.warn('No valid target or actor ID found');
            return '';
        }
    
        // 이베이전 특기 체크
        const hasEvasion = target.items?.find(item => 
            item.name === '이베이전' && 
            item.system?.props?.type === "specialty"
        );
    
        let defaultDefenseType = 'evasion';
        if (attackPart) {
            const partLower = attackPart.toLowerCase();
            if (partLower.includes('원격의 주무장') || partLower.includes('원격의 부무장')) {
                defaultDefenseType = 'pro';
            }
        }
    
        const defenseOptions = Object.entries(DefenseManager.DEFENSE_OPTIONS)
            .map(([key, val]) =>
                `<option value="${key}" ${key === defaultDefenseType ? 'selected' : ''}>${val.label}</option>`
            )
            .join('');
    
        let combatData = '{}';
        try {
            if (attackerItem && attacker) {
                console.log('Creating combat data with attack type:', attackType);
                const data = {
                    weapon: {
                        name: attackerItem.name,
                        weaponfinaldmg: attackerItem.weaponfinaldmg,
                        sidedamage: attackerItem.sidedamage,
                        dmgdiebonus: attacker.system.props.dmgdiebonus?.toString(),
                        dmgnumbonus: attacker.system.props.dmgnumbonus?.toString(),
                        part: attackerItem.part,
                        weapontype: attackerItem.weapontype,
                        atk: attackerItem.atk
                    },
                    attacker: {
                        id: attacker.id,
                        name: attacker.name,
                        tokenId: attackerToken?.id,
                        baseAttack: attacker.system.props[attackType],
                        attackType: attackType
                    }
                };
                combatData = JSON.stringify(data);
            }
        } catch (error) {
            console.error('[_getDefenseControlsHtml] Error preparing data:', error);
            combatData = '{}';
        }
    
        // 이베이전 특기가 있는 경우 자동 방어 실행
        if (hasEvasion) {
            const defenseBase = target.system.props[defaultDefenseType];
            const autoDefenseTotal = 7 + parseInt(defenseBase);
    
            setTimeout(async () => {
                await DefenseManager.performDefense(
                    targetId,
                    attackRoll,
                    defaultDefenseType,
                    0,
                    isCritical,
                    isFumble,
                    combatData,
                    autoDefenseTotal,
                    true,
                    [3, 4]
                );
            }, 500);
        }

        return `
            <div class="defense-controls" style="
                margin-top: 8px;
                padding: 8px;
                background: #f8f9fa;
                border-radius: 6px;">
                
                <div style="
                    display: flex;
                    gap: 8px;">
                    <select class="defense-type-select" style="
                        flex: 2;
                        padding: 4px 8px;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        background: white;
                        color: #4a4a4a;
                        font-size: var(--font-size-12);">
                        ${defenseOptions}
                    </select>
                    <input type="number" 
                           class="defense-modifier" 
                           value="0" 
                           style="
                               flex: 1;
                               padding: 4px 8px;
                               border: 1px solid #ddd;
                               border-radius: 4px;
                               background: white;
                               color: #4a4a4a;
                               font-size: var(--font-size-12);"
                           placeholder="수정치">
                </div>
                
                <button class="defense-roll-button" style="
                    width: 100%;
                    margin-top: 6px;
                    padding: 6px;
                    background: white;
                    color: #4a4a4a;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: var(--font-size-12);
                    font-weight: bold;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;"
                    data-target-id="${targetId || ''}"
                    data-actor-id="${actorId || ''}"
                    data-attack-roll="${attackRoll}"
                    data-is-critical="${isCritical}"
                    data-is-fumble="${isFumble}"
                    data-combat-data="${encodeURIComponent(combatData)}">
                    <i class="fas fa-shield-alt"></i>
                    방어 굴림
                </button>
            </div>
        `;
    }
    
    static async _showDamageSpecialtyDialog(attacker) {
        console.log("데미지 특기 다이얼로그 - 공격자 데이터:", attacker);
    
        // specialty 타입의 아이템만 필터링하고, sselect가 "데미지 굴림"인 것만 선택
        const selections = attacker.items
        .filter(item =>
            (item.system?.props?.type === "specialty" &&
             item.system?.props?.sselect === "데미지 굴림") ||
            (item.system?.props?.type === "item" &&
             item.system?.props?.iselect === "데미지 굴림") ||
            (item.system?.props?.type === "weapon" && 
             item.system?.props?.iselect === "데미지 굴림") ||
            (item.system?.props?.type === "option" && 
             item.system?.props?.iselect === "데미지 굴림") ||
            (item.system?.props?.type === "bless" && 
             !item.system?.props?.use && 
             item.system?.props?.iselect === "데미지 굴림")
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
    
static async performManualDamageRoll(weaponData, attacker, successfulHits = [], isCritical = false) {
    try {
        // 메시지 체크를 한 번만 수행
        const messages = game.messages.contents.slice(-20).reverse();
        let isDefenseCritical = false;
        let attackSpecialties = [];
 
        for (const message of messages) {
            if (message.content.includes('attack-message')) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(message.content, 'text/html');
                const defenseResults = doc.querySelectorAll('.defense-controls');
                
                for (const defense of defenseResults) {
                    if (defense.textContent.includes('방어 크리티컬!')) {
                        isDefenseCritical = true;
                        break;
                    }
                }
            }
 
            if (message.content.includes('multi-attack-roll')) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(message.content, 'text/html');
                const specialtyElements = doc.querySelectorAll('.specialty-button');
                attackSpecialties = Array.from(specialtyElements).map(el => ({
                    id: el.dataset.specialtyId,
                    name: el.dataset.specialtyName,
                    level: el.dataset.specialtyLevel,
                    timing: el.dataset.specialtyTiming,
                    target: el.dataset.specialtyTarget,
                    range: el.dataset.specialtyRange,
                    cost: el.dataset.specialtyCost,
                    effect: el.dataset.specialtyEffect
                }));
                break;
            }
        }
 
        console.log('데미지 계산 시작:', {
            weaponData,
            attacker,
            successfulHits,
            isCritical,
            isDefenseCritical  // 로그로 크리티컬 여부 확인
        });
 
        // 토큰과 액터 모두 가져오기
        const attackerToken = canvas.tokens.placeables.find(t => t.actor.id === attacker.id);
        const currentActor = attackerToken ? attackerToken.actor : game.actors.get(attacker.id);
        
        // 특기 선택과 활성화
        const selectedSpecialties = await this._showDamageSpecialtyDialog(currentActor);
        
        if (selectedSpecialties?.length) {
            const totalCost = this._calculateDamageSpecialtyCost(selectedSpecialties);
            if (!await this._handleDamageSpecialtyCost(totalCost, currentActor, selectedSpecialties)) {
                return;
            }
            await this._activateDamageEffects(attackerToken || currentActor, selectedSpecialties);
        }
 
        const updatedAttacker = attackerToken ? attackerToken.actor : game.actors.get(attacker.id);
        console.log('특기 활성화 후 actor 상태:', updatedAttacker);
        
        const currentDmgDieBonus = updatedAttacker.system.props.dmgdiebonus;
        const currentDmgNumBonus = updatedAttacker.system.props.dmgnumbonus;
        
        const weaponItem = attacker.items
        .filter(item => 
            item.system?.props?.type === "weapon" &&
            item.system?.props?.name === weaponData.name.replace(/\$/g, '')
        )[0];
 
        console.log('찾은 무기:', weaponItem);
 
        const isSniping = weaponItem?.system?.props?.sniping || false;
        const isArmorIgnore = weaponItem?.system?.props?.armorignore || false;
 
        // 데미지 계산을 위한 기본 수식 부분 준비
        let formulaParts = ['2d6'];

        const isPart = weaponData.part?.toLowerCase();
        const isSubWeapon = isPart?.includes('부무장');
        
        // 기본 대미지 추가 - 부무장이면 sidedamage 사용
        if (isSubWeapon) {
            console.log('Using side damage:', weaponData.sidedamage);
            if (weaponData.sidedamage && weaponData.sidedamage !== '0') {
                formulaParts.push(weaponData.sidedamage.replace('$', ''));
            }
        } else {
            console.log('Using final damage:', weaponData.weaponfinaldmg);
            if (weaponData.weaponfinaldmg && weaponData.weaponfinaldmg !== '0') {
                formulaParts.push(weaponData.weaponfinaldmg.replace('$', ''));
            }
        }
        
        // 공격력 추가
        if (weaponData.atk && weaponData.atk !== '0') {
            formulaParts.push(weaponData.atk.replace('$', ''));
        }
 
        // 주사위 보너스 추가
        if (currentDmgDieBonus && currentDmgDieBonus !== '0') {
            formulaParts.push(`${currentDmgDieBonus}d6`);
        }
 
        // 수치 보너스 추가
        if (currentDmgNumBonus && currentDmgNumBonus !== '0') {
            formulaParts.push(currentDmgNumBonus.toString());
        }
 
        // 방어 크리티컬이 아닐 때만 크리티컬 보너스 적용
        if (isCritical && !isDefenseCritical) {
            console.log('크리티컬 보너스 적용');
            const critDmgDieBonus = attacker.system.props.critdmgdiebonus || '0';
            const critDmgNumBonus = attacker.system.props.critdmgnumbonus || '0';
 
            if (critDmgDieBonus !== '0') {
                formulaParts.push(`${critDmgDieBonus}d6`);
                console.log('크리티컬 주사위 보너스 추가:', `${critDmgDieBonus}d6`);
            }
            if (critDmgNumBonus !== '0') {
                formulaParts.push(critDmgNumBonus);
                console.log('크리티컬 수치 보너스 추가:', critDmgNumBonus);
            }
        }
 
        const damageFormula = formulaParts.join('+');
        console.log('데미지 수식:', damageFormula);
 
        const damageRoll = new Roll(damageFormula);
        await damageRoll.evaluate({ async: true });
 
        if (game.dice3d) {
            await game.dice3d.showForRoll(damageRoll, game.user, true);
        }
 
        // 주사위 결과 HTML 생성
        const damageDiceResults = damageRoll.dice.map(d =>
            d.results.map(r => `
                <div class="roll die" style="
                    width: 24px;
                    height: 24px;
                    background: white;
                    border: 2px solid #ddd;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: var(--font-size-12);">
                    ${r.result}
                </div>`).join('')
        ).join('');
 
        // 채팅 메시지로 결과 표시
        await ChatMessage.create({
            content: `
                <div style="
                    background: #f0f0f0;
                    border-radius: 10px;
                    padding: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        background: white;
                        padding: 6px 10px;
                        border-radius: 8px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                        <div style="
                            display: flex;
                            align-items: center;
                            flex-wrap: wrap;
                            gap: 8px;">
                            <h3 style="
                                margin: 0;
                                font-size: var(--font-size-14);
                                color: #4a4a4a;">
                                ${weaponData.name.replace('$', '')} - 최종 데미지
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
                                    <strong style="color: #666;">사용된 특기/아이템</strong>
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
                    
                            <div class="collapsible-content" style="padding: 0 10px 10px 10px;">
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
                        background: white;
                        border-radius: 8px;
                        padding: 8px;
                        margin-top: 6px;
                        box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                        
                        ${successfulHits.length > 0 ? `
                            <div style="
                                font-size: var(--font-size-12);
                                color: #666;
                                margin-bottom: 4px;
                                overflow-x: auto;
                                white-space: nowrap;">
                                명중된 대상: ${successfulHits.join(', ')}
                            </div>
                        ` : ''}
         
                        <div style="
                            font-size: var(--font-size-12);
                            color: #666;
                            margin-bottom: 4px;
                            overflow-x: auto;
                            white-space: nowrap;">
                            ${damageFormula}
                        </div>
         
                        <div style="
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            background: #f8f9fa;
                            border-radius: 6px;
                            padding: 4px 8px;">
                            
                            <div style="
                                display: flex;
                                gap: 4px;
                                flex-wrap: wrap;
                                max-width: calc(100% - 50px);">
                                ${damageDiceResults}
                            </div>
                            
                            <span style="
                                flex-shrink: 0;
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
                </div>`,
            speaker: ChatMessage.getSpeaker(),
            type: CONST.CHAT_MESSAGE_STYLES.ROLL,
            roll: damageRoll
        });
 
        // 데미지 특기 효과 해제 (토큰이 있으면 토큰에서, 없으면 액터에서)
        if (selectedSpecialties?.length) {
            const effectTarget = attackerToken || currentActor;
            if (effectTarget) {
                await this._deactivateDamageEffects(effectTarget, selectedSpecialties);
            }
        }
        
        // 공격 특기 해제
        if (attackSpecialties.length > 0) {
            const effectTarget = attackerToken || currentActor;
            if (effectTarget) {
                await this._deactivateEffects(effectTarget, attackSpecialties);
            }
        }
 
    } catch (error) {
        console.error('데미지 계산 중 오류:', error);
        ui.notifications.error("데미지 계산 중 오류가 발생했습니다.");
    }
 }
    
     static _calculateDamageSpecialtyCost(selectedSpecialties) {
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
    
    static async _handleDamageSpecialtyCost(totalCost, attacker) {
        console.log("_handleDamageSpecialtyCost 시작:", {
            totalCost,
            attacker: attacker?.name
        });
    
        return new Promise((resolve) => {
            new Dialog({
                title: "데미지 특기 비용 소비 확인",
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
                                    let fpValue = attacker.system.props.fpvalue;
                                    await attacker.update({
                                        "system.props.fpvalue": fpValue - totalCost.fp
                                    });
                                }
    
                                // HP 소비
                                if (totalCost.hp > 0) {
                                    let hpValue = attacker.system.props.hpvalue;
                                    await attacker.update({
                                        "system.props.hpvalue": hpValue - totalCost.hp
                                    });
                                }
    
                                // EN 소비
                                if (totalCost.en > 0) {
                                    let enValue = attacker.system.props.envalue;
                                    await attacker.update({
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
    
    static async _activateDamageEffects(target, selectedSpecialties) {
        try {
            // target이 Token인지 Actor인지 확인하고 적절히 처리
            const actor = target.actor || target;
            let activeGroups = actor.system.activeConditionalModifierGroups || [];
    
            for (const specialty of selectedSpecialties) {
                const specialtyItem = actor.items.find(i => i.name === specialty.name?.replace('$', ''));
                if (!specialtyItem) continue;
    
                const modifierGroups = specialtyItem.system.modifiers
                    ?.filter(m => m.conditionalGroup)
                    ?.map(m => m.conditionalGroup) || [];
    
                modifierGroups.forEach(group => {
                    if (!activeGroups.includes(group)) {
                        activeGroups.push(group);
                    }
                });
            }
    
            await actor.update({
                "system.activeConditionalModifierGroups": activeGroups
            });
    
            ui.notifications.info(`선택한 특기 효과들이 활성화되었습니다.`);
        } catch (error) {
            console.error("효과 활성화 중 오류 발생:", error);
            ui.notifications.error("효과 활성화 중 오류가 발생했습니다.");
        }
    }
    
    static async _deactivateDamageEffects(target, selectedSpecialties) {
        try {
            const actor = target.actor || target;
            if (!actor || !actor.system) {
                console.error("유효한 액터를 찾을 수 없습니다:", target);
                return;
            }
    
            let activeGroups = actor.system.activeConditionalModifierGroups || [];
    
            for (const specialty of selectedSpecialties) {
                const specialtyItem = actor.items.find(i => i.name === specialty.name?.replace('$', ''));
                if (!specialtyItem) continue;
    
                const modifierGroups = specialtyItem.system.modifiers
                    ?.filter(m => m.conditionalGroup)
                    ?.map(m => m.conditionalGroup) || [];
    
                // 해당 특기의 그룹들 제거
                activeGroups = activeGroups.filter(group => !modifierGroups.includes(group));
            }
    
            // 업데이트
            await actor.update({
                "system.activeConditionalModifierGroups": activeGroups
            });
    
            ui.notifications.info("특기 효과가 종료되었습니다.");
        } catch (error) {
            console.error("데미지 효과 비활성화 중 오류 발생:", error);
        }
    }
    
    static async _deactivateEffects(target, selectedSpecialties) {
        try {
            const actor = target.actor || target;
            if (!actor || !actor.system) {
                console.error("유효한 액터를 찾을 수 없습니다:", target);
                return;
            }
    
            let activeGroups = actor.system.activeConditionalModifierGroups || [];
    
            for (const specialty of selectedSpecialties) {
                const specialtyItem = actor.items.find(i => i.name === specialty.name?.replace('$', ''));
                if (!specialtyItem) continue;
    
                const modifierGroups = specialtyItem.system.modifiers
                    ?.filter(m => m.conditionalGroup)
                    ?.map(m => m.conditionalGroup) || [];
    
                activeGroups = activeGroups.filter(group => !modifierGroups.includes(group));
            }
    
            await actor.update({
                "system.activeConditionalModifierGroups": activeGroups
            });
    
            ui.notifications.info("특기 효과가 종료되었습니다.");
        } catch (error) {
            console.error("효과 비활성화 중 오류 발생:", error);
        }
    }
    
    static async _applyDamageEffect(token, effectName) {
    // token이 없거나 document가 없는 경우 처리
    if (!token || !token.document) {
        console.warn(`토큰이 없거나 유효하지 않습니다: ${effectName} 상태를 적용할 수 없습니다.`);
        return;
    }

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
        console.error(`상태 적용 중 오류 발생:`, error);
        ui.notifications.error(`${effectName} 상태 적용 실패: ${error.message}`);
    }
}

static async showDamageDialog(data) {
    console.log('Received damage dialog data:', data);
    
    const { weaponData, attackerId, hitTargets = [], isCritical = false, defenseSpecialties, defenderId } = data;
    
    if (!weaponData || !attackerId) {
        console.error('Invalid damage dialog data:', data);
        return;
    }

    const attacker = game.actors.get(attackerId);
    if (!attacker) {
        console.error('Could not find attacker actor:', attackerId);
        return;
    }

    new Dialog({
        title: "데미지 굴림",
        content: `
            <style>
                .mcs-damage-roll-dialog .damage-dialog {
                    background: #f0f0f0;
                    padding: 15px;
                    border-radius: 8px;
                }
                .mcs-damage-roll-dialog .target-list {
                    background: white;
                    padding: 10px;
                    border-radius: 6px;
                    margin-bottom: 10px;
                }
                .mcs-damage-roll-dialog .weapon-info {
                    background: white;
                    padding: 10px;
                    border-radius: 6px;
                    margin-bottom: 10px;
                }
            </style>
            <div class="mcs-damage-roll-dialog">
                <div class="damage-dialog">
                    <div class="weapon-info">
                        <h3 style="margin: 0 0 10px 0;">${weaponData.name}</h3>
                        <div style="color: #666;">
                            ${weaponData.weapontype} / ${
                                weaponData.part?.includes('부무장') ? 
                                weaponData.sidedamage : 
                                weaponData.weaponfinaldmg
                            }
                        </div>
                    </div>
                    ${hitTargets.length > 0 ? `
                        <div class="target-list">
                            <strong>명중된 대상:</strong>
                            <div style="margin-top: 5px;">${hitTargets.join(', ')}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `,
        buttons: {
            roll: {
                icon: '<i class="fas fa-dice-d20"></i>',
                label: "데미지 굴림",
                callback: async () => {
                    await this.performManualDamageRoll(weaponData, attacker, hitTargets, isCritical);
                    
                    // 소켓립을 통해 특기 해제 요청
                    if (defenseSpecialties?.length && defenderId) {
                        await DefenseManager.socket.executeForEveryone('deactivateDefenseEffects', defenderId, defenseSpecialties);
                    }
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "취소",
                callback: async () => {
                    // 취소시에도 특기 해제
                    if (defenseSpecialties?.length && defenderId) {
                        await DefenseManager.socket.executeForEveryone('deactivateDefenseEffects', defenderId, defenseSpecialties);
                    }
                }
            }
        },
        default: "roll",
        classes: ['mcs-damage-roll-dialog']
    }).render(true);
}

// 공격 재굴림
static async rerollAttack(message, additionalModifier = 0, fixedResult = null, originalDiceResults = null) {
    try {
        console.log('Starting rerollAttack');
        if (fixedResult !== null && game.dice3d) {
            game.dice3d.messageHookDisabled = true;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(message.content, 'text/html');

        const attackMessage = doc.querySelector('.attack-message');
        if (!attackMessage) {
            console.error('Attack message not found');
            return;
        }

        const attackerId = attackMessage.dataset.attackerId;
        const attacker = game.actors.get(attackerId);
        if (!attacker) {
            console.error('Attacker not found:', attackerId);
            return;
        }
        console.log('Found attacker:', attacker.name);

        // 무기 데이터 구성
        const attackerItem = {
            name: attackMessage.dataset.weaponName,
            weaponcrit: attackMessage.dataset.weaponCrit,
            weapontype: attackMessage.dataset.weaponType,
            weaponrange: attackMessage.dataset.weaponRange,
            weaponcost: attackMessage.dataset.weaponCost,
            weaponfinaldmg: attackMessage.dataset.weaponFinalDmg,
            weaponeffect: decodeURIComponent(attackMessage.dataset.weaponEffect || ''),
            weaponkind: attackMessage.dataset.weaponKind,
            weapontarget: attackMessage.dataset.weaponTarget, 
            part: attackMessage.dataset.attackerItemPart || '근접',
            atk: attackMessage.dataset.attackerItemAtk || '0'
        };

        const attackType = attackMessage.dataset.attackType || 'hit';
        const modifier = parseInt(attackMessage.dataset.modifier || '0');

        // 대상 정보와 방어 결과 추출
        const targetSections = doc.querySelectorAll('.target-section');
        const targetsInfo = Array.from(targetSections).map(section => {
            const targetId = section.dataset.targetId;
            const combatData = section.dataset.combatData;
            
            const defenseResults = section.querySelector('.defense-roll, .defense-controls');
            const hasDefenseButton = defenseResults?.querySelector('.defense-roll-button');
            const hasCompleted = defenseResults && !hasDefenseButton;
        
            if (hasCompleted) {
                const vsSection = section.querySelector('div[style*="display:flex;align-items:center;justify-content:center;gap:20px"]');
                const defenseMatch = vsSection?.textContent.match(/(회피|방벽|행동|포격)\[(\d+)\]\s*(\d+)/);
        
                // 주사위 결과 추출
                const diceResults = [];
                const defenseDiceContainer = section.querySelector('.defense-dice-container');
                if (defenseDiceContainer) {
                    const diceElements = defenseDiceContainer.querySelectorAll('.roll.die.defense-die');
                    diceElements.forEach(die => {
                        const result = parseInt(die.textContent.trim());
                        if (!isNaN(result)) {
                            diceResults.push(result);
                        }
                    });
                }
                console.log("추출 주사위", diceResults)
        
                if (defenseMatch) {
                    return {
                        targetId,
                        combatData,
                        defenseType: {
                            '회피': 'evasion',
                            '방벽': 'pro',
                            '행동': 'init',
                            '포격': 'shelling'
                        }[defenseMatch[1]] || 'evasion',
                        defenseBase: parseInt(defenseMatch[2]),
                        defenseTotal: parseInt(defenseMatch[3]),
                        diceResults: diceResults, 
                        modifier: parseInt(section.querySelector('.defense-modifier')?.value || '0')
                    };
                }
            }
            return { targetId, combatData };
        });
        
        // 특기 정보 수집
        const specialtyButtons = doc.querySelectorAll('.specialty-button');
        const selectedSpecialties = Array.from(specialtyButtons).map(button => ({
            id: button.dataset.specialtyId,
            name: button.dataset.specialtyName,
            level: button.dataset.specialtyLevel,
            timing: button.dataset.specialtyTiming,
            target: button.dataset.specialtyTarget,
            range: button.dataset.specialtyRange,
            cost: button.dataset.specialtyCost,
            effect: button.dataset.specialtyEffect
        }));

        // 새 공격 굴림 실행
        const attackResults = await this.performMultiAttack(
            [attackerId],
            targetsInfo.map(t => t.targetId),
            attackType,
            modifier,
            attackerItem.weaponcrit,
            attacker.system.props.atkcritmod,
            attackerItem.part,
            attackerItem,
            selectedSpecialties,
            fixedResult,
            originalDiceResults    
        );

        console.log('Attack results:', attackResults);

        if (attackResults?.[0]) {
            // 각 대상에 대해 방어 결과 재계산
            for (const targetInfo of targetsInfo) {
                if (targetInfo.defenseTotal) {
                    await DefenseManager.performDefense(
                        targetInfo.targetId,
                        attackResults[0].roll.total,
                        targetInfo.defenseType,
                        targetInfo.modifier,
                        attackResults[0].isCritical,
                        attackResults[0].isFumble,
                        targetInfo.combatData,
                        targetInfo.defenseTotal,
                        true, 
                        targetInfo.diceResults
                    );
                }
            }
        }
    } catch (error) {
        console.error('Error during attack reroll:', error);
        ui.notifications.error("공격 재굴림 중 오류가 발생했습니다.");
    } finally {
        if (fixedResult !== null && game.dice3d) {
            game.dice3d.messageHookDisabled = false;
        }
    }
}

static async modifyAttackResult(message) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(message.content, 'text/html');
    
    // 원본 롤과 주사위 결과 가져오기 시도
    let originalDiceResults;
    let originalTotal;
    
    // 먼저 message.rolls에서 확인
    const originalRoll = message.rolls?.[0];
    if (originalRoll) {
        originalDiceResults = originalRoll.terms[0].results;
        originalTotal = originalRoll.total;
    } else {
        // rolls가 없다면 dataset에서 확인
        const attackMessage = doc.querySelector('.attack-message');
        originalTotal = parseInt(attackMessage?.dataset.originalRollTotal);
        originalDiceResults = attackMessage?.dataset.originalDiceResults ? 
            JSON.parse(attackMessage.dataset.originalDiceResults) : null;
    }
 
    if (isNaN(originalTotal) || !originalDiceResults) {
        ui.notifications.error("공격 결과값을 찾을 수 없습니다.");
        return;
    }
 
    new Dialog({
        title: "공격값 수정",
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
                    await this.rerollAttack(message, 0, newTotal, originalDiceResults);
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "취소"
            }
        },
        default: "submit"
    }).render(true);
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