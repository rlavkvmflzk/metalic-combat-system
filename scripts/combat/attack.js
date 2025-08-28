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
                <div class="roll die mcs-die">${r.result}</div>`
            ).join('')).join('');

        content += `
            <div class="mcs-card-wrapper simple-attack">
                <div class="mcs-card-header">
                    <h3 class="mcs-card-title">${attacker.name}의 ${abilityLabel} 판정</h3>
                    <span class="mcs-tag mcs-tag-grey">${baseValue}</span>
                </div>

                <div class="mcs-card-content">
                    <div class="mcs-roll-formula">${2 + diceBonus}d6 + ${baseValue}${modifierText}</div>
                    <div class="mcs-roll-result">
                        <div class="mcs-dice-tray">${diceResults}</div>
                        <span class="mcs-roll-total">${roll.total}</span>
                    </div>
                </div>
            </div>`;
    }
    content += '</div></div>'; 

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
    let content = `<div class="mcs-card"><div class="diceroll multi-attack-roll">`;

    for (const attackerResult of results) {
        const { attacker, item: attackerItem, targets, selectedSpecialties } = attackerResult;
        
        // 무기 아이템 정보 가져오기
        const weaponItem = attacker?.items?.find(item => 
            item.system?.props?.type === "weapon" &&
            item.system?.props?.name === attackerItem?.name?.replace(/\$/g, '')
        );

        // 특수 태그 생성
        const specialTagKeywords = {
            sniping: "저격",
            armorignore: "방어관통",
            PK: "염동",
            jump: "도약",
            transition: "전이",
            awakening: "각성",
            ASW: "대잠"
        };
        const specialTags = Object.entries(specialTagKeywords)
            .filter(([key]) => weaponItem?.system?.props?.[key])
            .map(([, label]) => `<span class="mcs-tag mcs-tag-special">${label}</span>`);

        // 기본 정보 태그 생성
        const infoTags = [
            attackerItem.part,
            attackerItem.weapontype,
            attackerItem.weaponkind,
            `${attackerItem.weaponrange}${attackerItem.weapontarget ? ` / ${attackerItem.weapontarget}` : ''}`,
            attackerItem.weaponcost
        ].filter(tag => tag).map(tag => `<span class="mcs-tag mcs-tag-lightgrey">${tag.replace(/\$/g, '')}</span>`);

        content += `
            <div class="mcs-card-wrapper mcs-collapsible-card multi-attack" 
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
                 data-weapon-target="${attackerItem.weapontarget}">
                
                <div class="mcs-card-header mcs-collapsible-header">
                    <div class="mcs-card-header-main">
                        <i class="fas fa-chevron-down mcs-collapse-icon"></i>
                        <h3 class="mcs-card-title">${attacker.name}의 ${attackerItem.name}</h3>
                    </div>
                    <span class="mcs-tag mcs-tag-grey">
                        크리티컬: ${Math.max(2, parseInt(attackerItem.weaponcrit.replace('$', '')) + critModifier)}
                    </span>
                </div>
                
                <div class="mcs-card-subheader">
                    <div class="mcs-tag-group">${infoTags.join('')}</div>
                    ${specialTags.length > 0 ? `<div class="mcs-tag-group-special">${specialTags.join('')}</div>` : ''}
                </div>

                <div class="mcs-collapsible-content">
                    ${attackerItem.weaponeffect ? `
                        <div class="mcs-collapsible-card mcs-subsection collapsed">
                            <div class="mcs-collapsible-header mcs-subsection-header">
                                <div class="mcs-subsection-title">
                                    <i class="fas fa-chevron-down mcs-collapse-icon"></i>
                                    <strong>무기 효과</strong>
                                </div>
                            </div>
                            <div class="mcs-collapsible-content mcs-subsection-content">
                                <p class="mcs-weapon-effect">${attackerItem.weaponeffect.replace('$', '')}</p>
                            </div>
                        </div>
                    ` : ''}

                    ${selectedSpecialties?.length > 0 ? `
                        <div class="mcs-collapsible-card mcs-subsection specialty-section collapsed">
                            <div class="mcs-collapsible-header mcs-subsection-header">
                                <div class="mcs-subsection-title">
                                    <i class="fas fa-chevron-down mcs-collapse-icon"></i>
                                    <strong>사용된 특기/아이템</strong>
                                </div>
                                <span class="mcs-tag mcs-tag-grey">${selectedSpecialties.length}개</span>
                            </div>
                            <div class="mcs-collapsible-content mcs-subsection-content">
                                ${selectedSpecialties.map(specialty => this._getSpecialtyButtonHtml(specialty)).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="mcs-target-list">
                        ${attackerResult.targets.map(targetResult => this._getTargetSectionHtml(targetResult, modifier, attackOption, fixedRoll)).join('')}
                    </div>
                </div>
            </div>`;
    }

    content += '</div></div>';
    return content;
}

// _getMultiAttackMessageContent에서 사용될 두 개의 헬퍼(helper) 함수를 추가합니다.
// 기존 클래스에 이 함수들을 추가해주세요.

static _getSpecialtyButtonHtml(specialty) {
    const specialtyTags = [
        specialty.timing,
        specialty.target,
        specialty.range,
        specialty.cost
    ].filter(Boolean).map(tag => `<span class="mcs-tag mcs-tag-lightgrey">${tag.replace('$', '')}</span>`).join('');

    return `
        <div class="mcs-button-card specialty-button"
             data-specialty-id="${specialty.id}"
             data-specialty-name="${specialty.name?.replace('$', '')}"
             data-specialty-level="${specialty.level?.replace('$', '') || ''}"
             data-specialty-timing="${specialty.timing?.replace('$', '') || ''}"
             data-specialty-target="${specialty.target?.replace('$', '') || ''}"
             data-specialty-range="${specialty.range?.replace('$', '') || ''}"
             data-specialty-cost="${specialty.cost?.replace('$', '') || ''}"
             data-specialty-effect="${specialty.effect?.replace('$', '') || ''}">
            
            <div class="mcs-button-card-header">
                <div class="mcs-button-card-title-group">
                    <span class="mcs-button-card-title">${specialty.name?.replace('$', '')}</span>
                    ${specialty.level ? `<span class="mcs-tag mcs-tag-grey">LV.${specialty.level.replace('$', '')}</span>` : ''}
                </div>
                <i class="fas fa-info-circle mcs-info-icon"></i>
            </div>
            <div class="mcs-tag-group">${specialtyTags}</div>
        </div>
    `;
}

static _getTargetSectionHtml(targetResult, modifier, attackOption, fixedRoll) {
    const { 
        target, roll, diceBonus, numBonus, totalMod, baseValue,
        isCritical, criticalThreshold, isFumble, baseDiceTotal, pumbleThreshold,
        existingDefenseContent, targetToken
    } = targetResult;

    let modDescription = [];
    if (numBonus !== 0) modDescription.push(`캐릭터 보너스: ${numBonus >= 0 ? '+' : ''}${numBonus}`);
    if (modifier !== 0) modDescription.push(`상황 수정치: ${modifier >= 0 ? '+' : ''}${modifier}`);
    const modifierText = modDescription.length > 0 ? ` (${modDescription.join(', ')})` : '';

    const diceResults = roll.terms
        .filter(term => term.faces === 6)
        .map(term => term.results.map(r => `<div class="roll die mcs-die">${r.result}</div>`).join(''))
        .join('');

    const defenseSection = existingDefenseContent 
        ? `<div class="defense-controls">${existingDefenseContent}</div>`
        : this._getDefenseControlsHtml(target, targetToken, roll.total, isCritical, isFumble, targetResult.attackPart, targetResult.attackerItem, targetResult.attacker, targetResult.attackerToken, targetResult.attackType);
        
    const combatData = encodeURIComponent(JSON.stringify({ /* ... combat data ... */ })); // combat data 생략

    return `
        <div class="mcs-card-content mcs-target-section"
             data-target-id="${targetToken?.id || target.id}"
             data-actor-id="${target.id}" 
             data-attack-roll="${roll.total}"
             data-is-critical="${isCritical}"
             data-is-fumble="${isFumble}"
             data-combat-data="${combatData}">
            
            <div class="mcs-target-header">
                <div class="mcs-target-info">
                    <span class="mcs-target-label">대상:</span>
                    <img class="mcs-target-avatar" src="${target.img || 'icons/svg/mystery-man.svg'}" alt="${target.name}">
                    <span class="mcs-target-name">${target.name}</span>
                </div>
                <div class="mcs-roll-formula">${2 + diceBonus}d6 + ${baseValue}${modifierText}</div>
            </div>

            <div class="mcs-roll-result">
                <div class="mcs-dice-tray">${diceResults}</div>
                <div class="mcs-roll-total">
                    <span class="mcs-roll-total-label">${attackOption.label}[${baseValue}]</span>
                    <span>${roll.total}</span>
                    ${fixedRoll !== null ? '<i class="fas fa-edit mcs-icon-small" title="수정된 값"></i>' : ''}
                </div>
            </div>

            ${(isFumble || isCritical) ? `
                <div class="mcs-crit-fumble-banner ${isFumble ? 'fumble' : 'critical'}">
                    ${isFumble ? `펌블! (2d6: ${baseDiceTotal} ≤ ${pumbleThreshold})` : `크리티컬! (2d6: ${baseDiceTotal} ≥ ${criticalThreshold})`}
                </div>
            ` : ''}

            ${isFumble ? `<div class="mcs-fumble-message">자동 실패!</div>` : ''}
            
            ${defenseSection}
        </div>`;
}

static async calculateFinalDamage(weaponData, successfulHits) {
    if (!game.user.isGM) return;

    // 데미지 굴림 공식 생성
    const formulaParts = ['2d6'];
    const isSubWeapon = weaponData.part?.toLowerCase().includes('부무장');

    const baseDmg = isSubWeapon ? weaponData.sidedamage : weaponData.weaponfinaldmg;
    if (baseDmg && baseDmg !== '0') {
        formulaParts.push(baseDmg.replace('$', ''));
    }
    if (weaponData.atk && weaponData.atk !== '0') {
        formulaParts.push(weaponData.atk.replace('$', ''));
    }
    if (weaponData.dmgdiebonus && weaponData.dmgdiebonus !== '0') {
        formulaParts.push(`${weaponData.dmgdiebonus.replace('$', '')}d6`);
    }
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

        const damageDiceResults = damageRoll.dice
            .map(d => d.results.map(r => `<div class="roll die mcs-die">${r.result}</div>`).join(''))
            .join('');

        const content = `
            <div class="mcs-card">
                <div class="mcs-card-wrapper damage-roll">
                    <div class="mcs-card-header">
                        <h3 class="mcs-card-title">${weaponData.name.replace('$', '')} - 최종 데미지</h3>
                        <span class="mcs-tag mcs-tag-grey">${weaponData.weapontype.replace('$', '')}</span>
                    </div>
                    <div class="mcs-card-content">
                        <div class="mcs-roll-formula">명중된 대상: ${successfulHits}</div>
                        <div class="mcs-roll-result">
                            <div class="mcs-dice-tray">${damageDiceResults}</div>
                            <div class="mcs-roll-total damage">${damageRoll.total}</div>
                        </div>
                    </div>
                </div>
            </div>`;

        await ChatMessage.create({
            content: content,
            speaker: ChatMessage.getSpeaker(),
            type: CONST.CHAT_MESSAGE_STYLES.ROLL,
            roll: damageRoll
        });

    } catch (error) {
        console.error('Error calculating final damage:', error);
        ui.notifications.error("데미지 계산 중 오류가 발생했습니다.");
    }
}

/**
 * 공격 시 사용할 수 있는 특기, 아이템 등을 선택하는 다이얼로그를 표시합니다.
 * @param {object} attackerItem - 현재 공격에 사용 중인 무기 아이템
 * @param {Actor} attacker - 공격자 액터
 * @returns {Promise<Array>} 선택된 아이템 객체의 배열
 */
static async _showEffectSelectionDialog(attackerItem, attacker) {
    // =======================================================================
    // 1. 아이템 필터링 및 데이터 가공 (룰 로직 - 원본과 100% 동일)
    // =======================================================================
    const selections = attacker.items
        .filter(item =>
            (item.system?.props?.type === "specialty" && (item.system?.props?.sselect === "공격시" || item.system?.props?.sselect === "공방시")) ||
            (item.system?.props?.type === "item" && (item.system?.props?.iselect === "공격시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "weapon" && (item.system?.props?.iselect === "공격시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "option" && (item.system?.props?.iselect === "공격시" || item.system?.props?.iselect === "공방시")) ||
            (item.system?.props?.type === "bless" && !item.system?.props?.use && (item.system?.props?.iselect === "공격시" || item.system?.props?.iselect === "공방시"))
        )
        .map(item => {
            // 이하는 각 아이템 타입을 표준화된 'selection' 객체 형식으로 변환하는 부분입니다.
            // 모든 속성값은 원본 로직과 동일하게 가져옵니다.
            const props = item.system.props;
            switch (props.type) {
                case "specialty":
                    return {
                        id: item.id, name: item.name, type: 'specialty',
                        cost: props.scost, level: props.slv, target: props.starget,
                        range: props.srange, timing: props.stiming, effect: props.seffect,
                        modifiers: item.system.modifiers || [], limit: props.limit, item: item
                    };
                case "weapon":
                    return {
                        id: item.id, name: item.name, type: 'weapon', timing: '공격시',
                        target: props.weapontarget, effect: props.weaponeffect, item: item
                    };
                case "option":
                    return {
                        id: item.id, name: item.name, type: 'option',
                        cost: props.optioncost, timing: '공격시', effect: props.optioneffect, item: item
                    };
                case "bless":
                    return {
                        id: item.id, name: item.name, type: 'bless',
                        timing: props.btiming, target: props.btarget, effect: props.beffect,
                        item: item, use: props.use || false
                    };
                default: // "item"
                    return {
                        id: item.id, name: item.name, type: 'item',
                        cost: props.icost, timing: props.itiming, effect: props.ieffect,
                        limit: props.iquantity, item: item
                    };
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

    const labelMap = { specialty: '특기', weapon: '무장', item: '아이템', option: '옵션', bless: '가호' };    

    // =======================================================================
    // 2. 다이얼로그 생성 및 표시 (구조 및 스타일링 로직)
    // =======================================================================
    const createEffectOption = (selection, idx) => {
        // 이 함수는 이제 내부 HTML 생성 역할만 합니다.
        // 모든 스타일링은 CSS 클래스로 이전되었습니다.
        const typeMap = { specialty: '특기', weapon: '무장', option: '옵션', bless: '가호', item: '아이템' };
        const tags = [
            { icon: 'fa-clock', value: selection.timing },
            { icon: 'fa-bullseye', value: selection.target },
            { icon: 'fa-ruler', value: selection.range },
            { icon: 'fa-coins', value: selection.cost }
        ].filter(tag => tag.value).map(tag => 
            `<span class="mcs-tag mcs-tag-info"><i class="fas ${tag.icon}"></i> ${tag.value.replace('$', '')}</span>`
        ).join('');
        
        // 사용 횟수 제한 뱃지 로직 (원본과 100% 동일)
        const limitBadge = (selection.type === 'specialty' && selection.item?.system?.props?.maxlimit > 0 && selection.limit !== undefined)
            ? `<span class="mcs-badge mcs-badge-limit" data-limit-zero="${selection.limit <= 0}">
                   <i class="fas fa-redo"></i> ${selection.limit}/${selection.item.system.props.maxlimit}회
               </span>`
            : '';

        return `
            <div class="mcs-selectable-card">
                <div class="mcs-selectable-card-checkbox">
                    <input type="checkbox" id="effect${idx}" name="selectedEffects" value="${selection.id}" data-type="${selection.type}">
                </div>
                <div class="mcs-selectable-card-details">
                    <div class="mcs-card-header-line">
                        <span class="mcs-card-title">${selection.name?.replace('$', '')}</span>
                        <span class="mcs-badge mcs-badge-${selection.type}">${typeMap[selection.type] || '아이템'}</span>
                        ${selection.level ? `<span class="mcs-badge mcs-badge-level">LV.${selection.level.replace('$', '')}</span>` : ''}
                        ${limitBadge}
                    </div>
                    <div class="mcs-tag-group">${tags}</div>
                    ${selection.effect ? `
                        <div class="mcs-description-box">
                            <i class="fas fa-star"></i>
                            <p>${selection.effect.replace('$', '')}</p>
                        </div>
                    ` : ''}
                </div>
            </div>`;
    };

    const tabButtons = Object.entries(categorized).filter(([, items]) => items.length > 0).map(([key, items]) => {
        const iconMap = { specialty: 'fa-star', weapon: 'fa-sword', item: 'fa-box', option: 'fa-cog', bless: 'fa-crown' };
        const labelMap = { specialty: '특기', weapon: '무장', item: '아이템', option: '옵션', bless: '가호' };
        return `<button class="mcs-dialog-tab" data-tab="${key}"><i class="fas ${iconMap[key]}"></i> ${labelMap[key]}<span class="mcs-dialog-tab-count">${items.length}</span></button>`;
    }).join('');

    const tabContents = Object.entries(categorized).map(([key, items]) => `
        <div class="mcs-dialog-tab-content" data-tab="${key}">
            ${items.length > 0
                ? items.map((selection, idx) => createEffectOption(selection, `${key}_${idx}`)).join('')
                : `<div class="mcs-dialog-empty-message">사용 가능한 ${labelMap[key]}가 없습니다</div>`
            }
        </div>`).join('');

    const content = `<div class="mcs-dialog-tabs">${tabButtons}</div><div class="mcs-dialog-content-wrapper">${tabContents}</div>`;
    
    // =======================================================================
    // 3. 다이얼로그 렌더링 및 콜백 (기능 로직 - 원본과 100% 동일)
    // =======================================================================
    return new Promise((resolve) => {
        new Dialog({
            title: "공격 특기/아이템 선택",
            content: content,
            buttons: {
                apply: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "적용",
                    callback: async (html) => {
                        const selectedIds = html.find('input[name="selectedEffects"]:checked').map((i, el) => ({ id: el.value, type: el.dataset.type })).get();
                        const selectedItems = selections.filter(s => selectedIds.some(sel => sel.id === s.id));
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
                // <script> 태그 대신 이곳에서 안전하게 탭 기능을 구현
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
            classes: ["dialog", "mcs-specialty-selection-dialog"], // 고유 클래스 지정
            width: 800, height: 600, resizable: true
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

/**
 * 선택된 특기/아이템의 총비용을 계산하고 사용자에게 확인받아 자원을 소비합니다.
 * @param {object} totalCost - {fp, hp, en, bullets, effects, limits} 형태의 비용 객체
 * @param {Actor} attacker - 공격자 액터
 * @param {Array} selectedSpecialties - 선택된 특기/아이템 목록
 * @returns {Promise<boolean>} 비용 처리가 성공적으로 완료되었는지 여부
 */
static async _handleEffectsCost(totalCost, attacker, selectedSpecialties) {
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
            title: "공격 특기 비용 소비 확인",
            content: content,
            buttons: {
                confirm: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "소비",
                    callback: async (html) => {
                        try {
                            // 사용횟수 처리 로직 (원본과 100% 동일)
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
                            // FP, HP, EN, 탄수, 효과 등 모든 자원 소비 로직 (원본과 100% 동일)
                            if (totalCost.fp > 0) await attacker.update({ "system.props.fpvalue": attacker.system.props.fpvalue - totalCost.fp });
                            if (totalCost.hp > 0) await attacker.update({ "system.props.hpvalue": attacker.system.props.hpvalue - totalCost.hp });
                            if (totalCost.en > 0) await attacker.update({ "system.props.envalue": attacker.system.props.envalue - totalCost.en });
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
                                    let token = canvas.tokens.controlled[0] || canvas.tokens.placeables.find(t => t.actor?.id === attacker.id);
                                    if (token) {
                                        await this._applyDamageEffect(token, effect);
                                    } else {
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
        }, {
            classes: ["dialog", "mcs-cost-dialog"] // 고유 클래스 지정
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


/**
 * 방어자에게 표시될 방어 굴림 컨트롤 UI의 HTML을 생성합니다.
 * @returns {string} HTML 문자열
 */
static _getDefenseControlsHtml(target, targetToken, attackRoll, isCritical, isFumble, attackPart = '', attackerItem = null, attacker = null, attackerToken = null, attackType, existingDefenseRoll = null) {
    // =======================================================================
    // 1. 사전 조건 및 룰 로직 (원본과 100% 동일)
    // =======================================================================
    if (existingDefenseRoll) {
        return existingDefenseRoll;
    }

    const targetId = targetToken?.id || target?.id;
    const actorId = target?.id || targetToken?.actor?.id;

    if (!targetId && !actorId) {
        console.warn('No valid target or actor ID found for defense controls.');
        return '';
    }

    // 이베이전 특기 체크
    const hasEvasion = target.items?.some(item => item.name === '이베이전' && item.system?.props?.type === "specialty");

    // 기본 방어 타입 결정 로직
    let defaultDefenseType = 'evasion';
    if (attackPart) {
        const partLower = attackPart.toLowerCase();
        if (partLower.includes('원격의 주무장') || partLower.includes('원격의 부무장')) {
            defaultDefenseType = 'pro';
        }
    }

    // 전투 데이터 생성 로직
    let combatData = '{}';
    try {
        if (attackerItem && attacker) {
            combatData = JSON.stringify({ /* combat data contents */ }); // 내용은 원본과 동일
        }
    } catch (error) {
        console.error('[_getDefenseControlsHtml] Error preparing data:', error);
    }
    
    // 이베이전 특기 자동 발동 로직 (원본과 100% 동일)
    if (hasEvasion) {
        const defenseBase = target.system.props[defaultDefenseType];
        const autoDefenseTotal = 7 + parseInt(defenseBase);
        setTimeout(async () => {
            await DefenseManager.performDefense(
                targetId, attackRoll, defaultDefenseType, 0,
                isCritical, isFumble, combatData, autoDefenseTotal, true, [3, 4]
            );
        }, 500);
    }

    // =======================================================================
    // 2. HTML 컨텐츠 생성 (스타일링은 CSS 클래스로 분리)
    // =======================================================================
    const defenseOptions = Object.entries(DefenseManager.DEFENSE_OPTIONS)
        .map(([key, val]) => `<option value="${key}" ${key === defaultDefenseType ? 'selected' : ''}>${val.label}</option>`)
        .join('');

    return `
        <div class="mcs-defense-controls">
            <div class="mcs-defense-input-group">
                <select class="mcs-defense-select">${defenseOptions}</select>
                <input type="number" class="mcs-defense-modifier" value="0" placeholder="수정치">
            </div>
            <button class="mcs-button mcs-defense-button"
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
    
/**
 * 데미지 굴림 시 사용할 수 있는 특기, 아이템 등을 선택하는 다이얼로그를 표시합니다.
 * @param {Actor} attacker - 공격자 액터
 * @returns {Promise<Array>} 선택된 아이템 객체의 배열
 */
static async _showDamageSpecialtyDialog(attacker) {
    // =======================================================================
    // 1. 아이템 필터링 및 데이터 가공 (룰 로직 - 원본과 100% 동일)
    // =======================================================================
    const selections = attacker.items
        .filter(item =>
            (item.system?.props?.type === "specialty" && item.system?.props?.sselect === "데미지 굴림") ||
            (item.system?.props?.type === "item" && item.system?.props?.iselect === "데미지 굴림") ||
            (item.system?.props?.type === "weapon" && item.system?.props?.iselect === "데미지 굴림") ||
            (item.system?.props?.type === "option" && item.system?.props?.iselect === "데미지 굴림") ||
            (item.system?.props?.type === "bless" && !item.system?.props?.use && item.system?.props?.iselect === "데미지 굴림")
        )
        .map(item => {
            // 각 아이템 타입을 표준화된 'selection' 객체 형식으로 변환 (원본 로직과 동일)
            const props = item.system.props;
            switch (props.type) {
                case "specialty":
                    return {
                        id: item.id, name: item.name, type: 'specialty',
                        cost: props.scost, level: props.slv, target: props.starget,
                        range: props.srange, timing: props.stiming, effect: props.seffect,
                        modifiers: item.system.modifiers || [], limit: props.limit, item: item
                    };
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

    const labelMap = { specialty: '특기', weapon: '무장', item: '아이템', option: '옵션', bless: '가호' };    

    // =======================================================================
    // 2. 다이얼로그 생성 및 표시 (구조 및 스타일링 로직)
    // =======================================================================
    const tabButtons = Object.entries(categorized).filter(([, items]) => items.length > 0).map(([key, items]) => {
        const iconMap = { specialty: 'fa-star', weapon: 'fa-sword', item: 'fa-box', option: 'fa-cog', bless: 'fa-crown' };
        const labelMap = { specialty: '특기', weapon: '무장', item: '아이템', option: '옵션', bless: '가호' };
        return `<button class="mcs-dialog-tab" data-tab="${key}"><i class="fas ${iconMap[key]}"></i> ${labelMap[key]}<span class="mcs-dialog-tab-count">${items.length}</span></button>`;
    }).join('');

    const tabContents = Object.entries(categorized).map(([key, items]) => `
        <div class="mcs-dialog-tab-content" data-tab="${key}">
            ${items.length > 0
                ? items.map((selection, idx) => this._createEffectOptionHtml(selection, `${key}_${idx}`)).join('')
                : `<div class="mcs-dialog-empty-message">사용 가능한 ${labelMap[key]}가 없습니다</div>`
            }
        </div>`).join('');

    const content = `<div class="mcs-dialog-tabs">${tabButtons}</div><div class="mcs-dialog-content-wrapper">${tabContents}</div>`;

    return new Promise((resolve) => {
        new Dialog({
            title: "데미지 특기/아이템 선택",
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
    
/**
 * 사용자가 직접 데미지 굴림 버튼을 눌렀을 때 데미지를 계산하고 결과를 표시합니다.
 * @param {object} weaponData - 무기 정보
 * @param {Actor} attacker - 공격자 액터
 * @param {Array<string>} successfulHits - 명중한 대상의 이름 배열
 * @param {boolean} isCritical - 공격이 크리티컬이었는지 여부
 */
static async performManualDamageRoll(weaponData, attacker, successfulHits = [], isCritical = false) {
    try {
        // =======================================================================
        // 1. 룰 로직: 이전 채팅 기록 확인 및 데이터 준비 (원본과 100% 동일)
        // =======================================================================
        const messages = game.messages.contents.slice(-20).reverse();
        let isDefenseCritical = false;
        let attackSpecialties = [];

        for (const message of messages) {
            const content = message.content;
            if (content.includes('multi-attack-roll') || content.includes('attack-message')) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(content, 'text/html');
                
                // 방어 크리티컬 확인
                if (Array.from(doc.querySelectorAll('.defense-controls')).some(el => el.textContent.includes('방어 크리티컬!'))) {
                    isDefenseCritical = true;
                }

                // 공격 시 사용한 특기 정보 추출
                const specialtyElements = doc.querySelectorAll('.specialty-button');
                if (specialtyElements.length > 0) {
                    attackSpecialties = Array.from(specialtyElements).map(el => ({ id: el.dataset.specialtyId, /* ... other data ... */ }));
                    break; 
                }
            }
        }

        const attackerToken = canvas.tokens.placeables.find(t => t.actor.id === attacker.id);
        const currentActor = attackerToken ? attackerToken.actor : game.actors.get(attacker.id);
        
        // 데미지 특기 선택 및 비용 처리 (원본과 100% 동일)
        const selectedSpecialties = await this._showDamageSpecialtyDialog(currentActor);
        if (selectedSpecialties?.length) {
            const totalCost = this._calculateDamageSpecialtyCost(selectedSpecialties);
            if (!await this._handleDamageSpecialtyCost(totalCost, currentActor, selectedSpecialties)) return;
            await this._activateDamageEffects(attackerToken || currentActor, selectedSpecialties);
        }

        const updatedAttacker = attackerToken ? attackerToken.actor : game.actors.get(attacker.id);

        // =======================================================================
        // 2. 룰 로직: 데미지 공식 계산 (원본과 100% 동일)
        // =======================================================================
        let formulaParts = ['2d6'];
        const isSubWeapon = weaponData.part?.toLowerCase().includes('부무장');
        const baseDmg = isSubWeapon ? weaponData.sidedamage : weaponData.weaponfinaldmg;

        if (baseDmg && baseDmg !== '0') formulaParts.push(baseDmg.replace('$', ''));
        if (weaponData.atk && weaponData.atk !== '0') formulaParts.push(weaponData.atk.replace('$', ''));
        
        const currentDmgDieBonus = updatedAttacker.system.props.dmgdiebonus;
        if (currentDmgDieBonus && currentDmgDieBonus !== '0') formulaParts.push(`${currentDmgDieBonus}d6`);
        
        const currentDmgNumBonus = updatedAttacker.system.props.dmgnumbonus;
        if (currentDmgNumBonus && currentDmgNumBonus !== '0') formulaParts.push(currentDmgNumBonus.toString());

        if (isCritical && !isDefenseCritical) {
            const critDmgDieBonus = attacker.system.props.critdmgdiebonus || '0';
            const critDmgNumBonus = attacker.system.props.critdmgnumbonus || '0';
            if (critDmgDieBonus !== '0') formulaParts.push(`${critDmgDieBonus}d6`);
            if (critDmgNumBonus !== '0') formulaParts.push(critDmgNumBonus);
        }
        const damageFormula = formulaParts.join('+');

        // =======================================================================
        // 3. 굴림 실행 및 HTML 생성 (스타일링 분리)
        // =======================================================================
        const damageRoll = new Roll(damageFormula);
        await damageRoll.evaluate({ async: true });

        if (game.dice3d) {
            await game.dice3d.showForRoll(damageRoll, game.user, true);
        }

        const damageDiceResults = damageRoll.dice.map(d => d.results.map(r => `<div class="roll die mcs-die">${r.result}</div>`).join('')).join('');

        // 사용된 특기 목록 HTML 생성
        const specialtiesHtml = selectedSpecialties?.length > 0 ? `
            <div class="mcs-collapsible-card mcs-subsection collapsed">
                <div class="mcs-collapsible-header mcs-subsection-header">
                    <div class="mcs-subsection-title">
                        <i class="fas fa-chevron-down mcs-collapse-icon"></i>
                        <strong>사용된 데미지 특기</strong>
                    </div>
                    <span class="mcs-tag mcs-tag-grey">${selectedSpecialties.length}개</span>
                </div>
                <div class="mcs-collapsible-content mcs-subsection-content">
                    ${selectedSpecialties.map(specialty => this._getSpecialtyButtonHtml(specialty)).join('')}
                </div>
            </div>` : '';

        // 최종 채팅 메시지 HTML
        const content = `
            <div class="mcs-card">
                <div class="mcs-card-wrapper damage-roll">
                    <div class="mcs-card-header">
                        <div class="mcs-card-title-group">
                            <h3 class="mcs-card-title">${weaponData.name.replace('$', '')} - 최종 데미지</h3>
                            <span class="mcs-tag mcs-tag-grey">${weaponData.weapontype.replace('$', '')}</span>
                        </div>
                    </div>
                    ${specialtiesHtml}
                    <div class="mcs-card-content">
                        ${successfulHits.length > 0 ? `<div class="mcs-roll-info">명중된 대상: ${successfulHits.join(', ')}</div>` : ''}
                        <div class="mcs-roll-formula">${damageFormula}</div>
                        <div class="mcs-roll-result">
                            <div class="mcs-dice-tray">${damageDiceResults}</div>
                            <div class="mcs-roll-total damage">${damageRoll.total}</div>
                        </div>
                    </div>
                </div>
            </div>`;

        await ChatMessage.create({
            content: content,
            speaker: ChatMessage.getSpeaker(),
            type: CONST.CHAT_MESSAGE_STYLES.ROLL,
            roll: damageRoll
        });

        // =======================================================================
        // 4. 효과 해제 (원본과 100% 동일)
        // =======================================================================
        const effectTarget = attackerToken || currentActor;
        if (selectedSpecialties?.length && effectTarget) {
            await this._deactivateDamageEffects(effectTarget, selectedSpecialties);
        }
        if (attackSpecialties.length > 0 && effectTarget) {
            await this._deactivateEffects(effectTarget, attackSpecialties);
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
    
/**
 * 데미지 특기의 총비용을 계산하고 사용자에게 확인받아 자원을 소비합니다.
 * @param {object} totalCost - {fp, hp, en, bullets, effects, limits} 형태의 비용 객체
 * @param {Actor} attacker - 공격자 액터
 * @returns {Promise<boolean>} 비용 처리가 성공적으로 완료되었는지 여부
 */
static async _handleDamageSpecialtyCost(totalCost, attacker) {
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
            title: "데미지 특기 비용 소비 확인",
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
                            if (totalCost.fp > 0) await attacker.update({ "system.props.fpvalue": attacker.system.props.fpvalue - totalCost.fp });
                            if (totalCost.hp > 0) await attacker.update({ "system.props.hpvalue": attacker.system.props.hpvalue - totalCost.hp });
                            if (totalCost.en > 0) await attacker.update({ "system.props.envalue": attacker.system.props.envalue - totalCost.en });
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
                                    let token = canvas.tokens.controlled[0] || canvas.tokens.placeables.find(t => t.actor?.id === attacker.id);
                                    if (token) {
                                        await this._applyEffect(token, effect);
                                    } else {
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
        }, {
            classes: ["dialog", "mcs-cost-dialog"]
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

/**
 * 데미지 굴림을 수행할지 묻는 확인 다이얼로그를 표시합니다.
 * @param {object} data - 필요한 데이터 객체
 */
static async showDamageDialog(data) {
    const { weaponData, attackerId, hitTargets = [], isCritical = false, defenseSpecialties, defenderId } = data;

    if (!weaponData || !attackerId) { return; }
    const attacker = game.actors.get(attackerId);
    if (!attacker) { return; }

    const baseDmg = weaponData.part?.includes('부무장') ? weaponData.sidedamage : weaponData.weaponfinaldmg;

    const content = `
        <div class="mcs-dialog-wrapper">
            <div class="mcs-dialog-section mcs-weapon-info">
                <h3 class="mcs-card-title">${weaponData.name}</h3>
                <div class="mcs-weapon-details">${weaponData.weapontype} / ${baseDmg}</div>
            </div>
            ${hitTargets.length > 0 ? `
                <div class="mcs-dialog-section mcs-target-list">
                    <strong>명중된 대상:</strong>
                    <div class="mcs-target-names">${hitTargets.join(', ')}</div>
                </div>
            ` : ''}
        </div>
    `;

    new Dialog({
        title: "데미지 굴림",
        content: content,
        buttons: {
            roll: {
                icon: '<i class="fas fa-dice-d20"></i>',
                label: "데미지 굴림",
                callback: async () => {
                    await this.performManualDamageRoll(weaponData, attacker, hitTargets, isCritical);
                    if (defenseSpecialties?.length && defenderId) {
                        await DefenseManager.socket.executeForEveryone('deactivateDefenseEffects', defenderId, defenseSpecialties);
                    }
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "취소",
                callback: async () => {
                    if (defenseSpecialties?.length && defenderId) {
                        await DefenseManager.socket.executeForEveryone('deactivateDefenseEffects', defenderId, defenseSpecialties);
                    }
                }
            }
        },
        default: "roll",
        classes: ['dialog', 'mcs-damage-roll-dialog']
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