import { CombatManager } from './combat/attack.js';
import { DefenseManager } from './combat/defense.js';
import { DiceHelper } from './utils/dice.js';
import { WeaponEffects } from './effects/weaponEffects.js';
import { StatCheck, StatCheckDialog } from './utils/statCheck.js';
import { DamageManager } from './utils/damageManager.js';
import { TransformationManager } from './utils/TransformationManager.js';
import { SyncManager } from './sync/SyncManager.js';
import { ActorStatusManager } from './status/ActorStatusManager.js';
import { StatusEffectManager } from './status/StatusEffectManager.js';
import { CombatInfoManager } from './status/CombatInfoManager.js';
import { TemplateManager } from './status/TemplateManager.js';

class MetalicCombatSystem {
    static ID = "metalic-combat-system";

    static init() {
        console.log('MCS | Init called');
        this._registerSettings();
        this._exposeAPI();

        game.settings.register(this.ID, 'overrideInitiative', {
            name: "이니셔티브 공식 변경",
            hint: "시스템의 이니셔티브 공식을 init 값으로 자동 변경합니다.",
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: value => {
                if (value) {
                    this._overrideInitiative();
                } else {
                    // 원래 시스템 설정으로 복구
                    game.settings.set(game.system.id, 'initFormula', '[1d20]');
                }
            }
        });

        // 기본 장면 설정 추가
        game.settings.register('metalic-combat-system', 'sceneDefaults', {
            scope: 'world',
            config: false,
            type: Object,
            default: {
                grid: {
                    type: CONST.GRID_TYPES.SQUARE,
                    distance: 0.5,
                    units: "칸"
                }
            }
        });
    
        // Scene 생성 전에 기본 설정 적용
        Hooks.on('preCreateScene', (doc, data, options, userId) => {
            const defaults = game.settings.get('metalic-combat-system', 'sceneDefaults');
            doc.updateSource(foundry.utils.mergeObject(defaults, data, {inplace: false}));
        });
        
        // GM 메뉴에 대미지 처리 버튼 추가
        Hooks.on('getSceneControlButtons', (controls) => {
            const tokenControls = controls.find(c => c.name === "token");
            if (tokenControls && DamageManager.hasPermission()) {
                tokenControls.tools.push({
                    name: "process-damage",
                    title: "대미지 처리",
                    icon: "fas fa-heart-broken",
                    button: true,
                    onClick: () => DamageManager.showDamageDialog()
                });
            }
        });
    
        // 채팅 메시지 컨텍스트 메뉴 확장
        Hooks.on('getChatLogEntryContext', (html, options) => {
            options.push({
                name: "공격 재굴림",
                icon: '<i class="fas fa-dice"></i>',
                condition: li => {
                    const message = game.messages.get(li.attr('data-message-id'));
                    return message?.content?.includes('attack-message');
                },
                callback: async (li) => {
                    const message = game.messages.get(li.attr('data-message-id'));
                    if (message) await CombatManager.rerollAttack(message);
                }
            });
    
            options.push({
                name: "방어 재굴림",
                icon: '<i class="fas fa-shield"></i>',
                condition: li => {
                    const message = game.messages.get(li.attr('data-message-id'));
                    if (!message?.content) return false;
                    const doc = new DOMParser().parseFromString(message.content, 'text/html');
                    return doc.querySelector('.defense-controls') && doc.querySelector('.attack-message');
                },
                callback: async (li) => {
                    const message = game.messages.get(li.attr('data-message-id'));
                    if (message) await DefenseManager.rerollDefense(message);
                }
            });
    
            options.push({
                name: "공격 결과 수정",
                icon: '<i class="fas fa-calculator"></i>',
                condition: li => {
                    const message = game.messages.get(li.attr('data-message-id'));
                    return message?.content?.includes('attack-message');
                },
                callback: async (li) => {
                    const message = game.messages.get(li.attr('data-message-id'));
                    if (message) await CombatManager.modifyAttackResult(message);
                }
            });
    
            options.push({
                name: "방어 결과 수정",
                icon: '<i class="fas fa-calculator"></i>',
                condition: li => {
                    const message = game.messages.get(li.attr('data-message-id'));
                    return message?.content?.includes('defense-controls');
                },
                callback: async (li) => {
                    const message = game.messages.get(li.attr('data-message-id'));
                    if (message) await DefenseManager.modifyDefenseResult(message);
                }
            });
        });
    
        // 전투 관련 훅 등록
        Hooks.on('createCombat', async (combat) => {
            if (!game.user.isGM || !game.settings.get(this.ID, 'enableInitiativePhase')) return;
            await this.createCombatPhases(combat);
        });
    
        Hooks.once('ready', () => {
            console.log('MCS | Registering combat turn handler');
            
            libWrapper.register(this.ID, 'Combat.prototype.nextTurn', async function(wrapped, ...args) {
                console.log('MCS | nextTurn called');
                
                if (!game.settings.get('metalic-combat-system', 'enableInitiativePhase')) {
                    console.log('MCS | Initiative phase disabled, using default turn handling');
                    return wrapped(...args);
                }
            
                const combat = this;
                const currentCombatant = combat.combatant;
                
                console.log('Current combat state:', {
                    round: combat.round,
                    turn: combat.turn,
                    currentCombatant: currentCombatant?.name,
                    isPhase: currentCombatant?.flags?.metalicCombatSystem?.isPhase,
                    phaseType: currentCombatant?.flags?.metalicCombatSystem?.phaseType
                });
            
                if (!currentCombatant) return wrapped(...args);
            
                // 현재 턴의 소유자인지 확인
                const isOwner = currentCombatant.actor?.isOwner || game.user.isGM;
                if (!isOwner) {
                    ui.notifications.warn("자신의 턴에만 턴을 넘길 수 있습니다.");
                    return null;
                }
            
                const isPhase = currentCombatant.flags?.metalicCombatSystem?.isPhase;
                const phaseType = currentCombatant.flags?.metalicCombatSystem?.phaseType;
                const phaseTurn = combat.turns.find(t => t.flags?.metalicCombatSystem?.phaseType === "initiative");
                const setupTurn = combat.turns.find(t => t.flags?.metalicCombatSystem?.phaseType === "setup");
                const cleanupTurn = combat.turns.find(t => t.flags?.metalicCombatSystem?.phaseType === "cleanup");
                const regularTurns = combat.turns.filter(t => !t.flags?.metalicCombatSystem?.isPhase);
            
                // 플레이어가 턴을 넘기려고 할 때 GM에게 요청
                if (!game.user.isGM) {
                    await MetalicCombatSystem.SOCKET.executeAsGM('processTurnChange', combat.id, {
                        isPhase,
                        phaseType,
                        currentTurn: combat.turn
                    });
                    return null;
                }
            
                if (!isPhase) {
                    // 일반 턴이 끝나면 무조건 이니셔티브 페이즈로
                    console.log('Regular turn ended, moving to initiative phase');
                    await MetalicCombatSystem.SOCKET.executeAsGM('updateCombatFlag', 
                        combat.id, 
                        'lastRegularTurn', 
                        combat.turns.indexOf(currentCombatant)
                    );
            
                    await combat.update({turn: combat.turns.indexOf(phaseTurn)});
                    await ChatMessage.create({
                        content: `<h2>이니셔티브 페이즈</h2><p>다음 턴에 행동할 캐릭터를 결정합니다. 턴 사이에 발동되는 효과들을 처리하세요.</p>`,
                        type: CONST.CHAT_MESSAGE_TYPES.OTHER
                    });
                    return null;
            
                } else if (phaseType === "initiative") {
                    console.log('Processing initiative phase');
                    const lastRegularTurn = combat.getFlag('metalic-combat-system', 'lastRegularTurn');
                    const lastTurnCombatant = lastRegularTurn !== null ? combat.turns[lastRegularTurn] : null;
                    
                    // 다음 행동할 캐릭터 찾기
                    let nextCombatant = null;
                    if (!lastTurnCombatant) {
                        // 첫 턴이면 가장 높은 이니셔티브부터 시작
                        nextCombatant = regularTurns
                            .sort((a, b) => b.initiative - a.initiative)[0];
                    } else {
                        // 현재 이니셔티브에서 아직 행동하지 않은 캐릭터 찾기
                        const currentInitiative = lastTurnCombatant.initiative;
                        const sameInitiativeTurns = regularTurns
                            .filter(t => 
                                t.initiative === currentInitiative && 
                                combat.turns.indexOf(t) > lastRegularTurn
                            );
            
                        if (sameInitiativeTurns.length > 0) {
                            // 같은 이니셔티브 그룹에 남은 캐릭터가 있음
                            nextCombatant = sameInitiativeTurns[0];
                        } else {
                            // 다음 이니셔티브 그룹으로
                            const remainingTurns = regularTurns
                                .filter(t => t.initiative < currentInitiative)
                                .sort((a, b) => b.initiative - a.initiative);
                            
                            nextCombatant = remainingTurns[0];
                        }
                    }
            
                    if (!nextCombatant) {
                        // 더 이상 행동할 캐릭터가 없으면 클린업으로
                        console.log('No more characters to act, moving to cleanup phase');
                        await MetalicCombatSystem.SOCKET.executeAsGM('updateCombatFlag', 
                            combat.id, 
                            'lastRegularTurn', 
                            null
                        );
                        
                        await combat.update({turn: combat.turns.indexOf(cleanupTurn)});
                        await ChatMessage.create({
                            content: `<h2>클린업 페이즈</h2><p>라운드가 종료됩니다. 턴 종료 시 발동되는 효과들을 처리하세요.</p>`,
                            type: CONST.CHAT_MESSAGE_TYPES.OTHER
                        });
                    } else {
                        console.log('Moving to next character:', nextCombatant.name);
                        await combat.update({turn: combat.turns.indexOf(nextCombatant)});
                    }
                    return null;
            
                } else if (phaseType === "cleanup") {
                    console.log('Processing cleanup phase');
                    await combat.nextRound();
                    await combat.update({turn: combat.turns.indexOf(setupTurn)});
                    await ChatMessage.create({
                        content: `<h2>셋업 페이즈</h2><p>새로운 라운드가 시작됩니다. 라운드 시작 시 발동되는 효과들을 처리하세요.</p>`,
                        type: CONST.CHAT_MESSAGE_TYPES.OTHER
                    });
                    return null;
            
                } else if (phaseType === "setup") {
                    console.log('Processing setup phase');
                    await combat.update({turn: combat.turns.indexOf(phaseTurn)});
                    await ChatMessage.create({
                        content: `<h2>이니셔티브 페이즈</h2><p>다음 턴에 행동할 캐릭터를 결정합니다. 턴 사이에 발동되는 효과들을 처리하세요.</p>`,
                        type: CONST.CHAT_MESSAGE_TYPES.OTHER
                    });
                    return null;
                }
            
                return wrapped(...args);
            }, 'MIXED');
        });
    
        // 전투 시작/종료 시 초기화
        Hooks.on('combatStart', async (combat) => {
            if (game.settings.get(this.ID, 'enableInitiativePhase')) {
                await combat.setFlag('metalic-combat-system', 'lastRegularTurn', null);
                const setupPhase = combat.turns.find(t => 
                    t.flags?.metalicCombatSystem?.isPhase && 
                    t.flags?.metalicCombatSystem?.phaseType === "setup"
                );
                if (setupPhase) {
                    await combat.update({turn: combat.turns.indexOf(setupPhase)});
                    await ChatMessage.create({
                        content: `<h2>셋업 페이즈</h2><p>새로운 라운드가 시작됩니다. 라운드 시작 시 발동되는 효과들을 처리하세요.</p>`,
                        type: CONST.CHAT_MESSAGE_TYPES.OTHER
                    });
                }
            }
        });
    
        Hooks.on('combatEnd', async (combat) => {
            if (game.settings.get(this.ID, 'enableInitiativePhase')) {
                await combat.setFlag('metalic-combat-system', 'lastRegularTurn', null);
            }
        });
    
        // 라운드 변경 처리
        Hooks.on('updateCombat', async (combat, changes) => {
            if (!game.settings.get(this.ID, 'enableInitiativePhase')) return;
            
            if (changes.round && changes.round > combat.previous.round) {
                if (combat.getFlag('metalic-combat-system', 'nextRoundSetup')) {
                    const setupPhase = combat.turns.find(t => 
                        t.flags?.metalicCombatSystem?.isPhase && 
                        t.flags?.metalicCombatSystem?.phaseType === "setup"
                    );
                    if (setupPhase) {
                        await combat.update({turn: combat.turns.indexOf(setupPhase)});
                    }
                }
            }
        });

// 턴/라운드 변경 시 처리
Hooks.on('updateCombat', async (combat, changes, options, userId) => {
    if (!game.settings.get(MetalicCombatSystem.ID, 'enableInitiativePhase')) return;
    
    // 변경사항 확인
    const isTurnChange = changes.turn !== undefined;
    const isRoundChange = changes.round !== undefined && changes.round > combat.previous.round;
    
    if (isTurnChange || isRoundChange) {
        console.log('Turn or Round changed:', { isTurnChange, isRoundChange });
        
        for (let combatant of combat.combatants) {
            const actor = combatant.actor;
            if (!actor) continue;

            for (let item of actor.items) {
                // 특기이며 maxlimit가 1 이상인 경우만 처리
                if (item.system?.props?.type === "specialty" && 
                    item.system?.props?.maxlimit > 0) {
                    
                    const maxLimit = parseInt(item.system.props.maxlimit);
                    const currentLimit = parseInt(item.system.props.limit);
                    const limitTerm = item.system.props.limitterm;

                    console.log('Checking item recovery:', {
                        name: item.name,
                        maxLimit,
                        currentLimit,
                        limitTerm
                    });

                    // 회복이 필요한 경우만 처리
                    if (currentLimit < maxLimit) {
                        if (limitTerm === "턴마다" && isTurnChange) {
                            console.log(`Recovering ${item.name} - Turn based`);
                            await item.update({
                                "system.props.limit": maxLimit
                            });
                        } else if (limitTerm === "라운드마다" && isRoundChange) {
                            console.log(`Recovering ${item.name} - Round based`);
                            await item.update({
                                "system.props.limit": maxLimit
                            });
                        }
                    }
                }
            }
        }
    }
});

// 전투 종료 시 처리
Hooks.on('deleteCombat', async (combat) => {
    console.log('Combat ended, processing recovery');
    
    for (let combatant of combat.combatants) {
        const actor = combatant.actor;
        if (!actor) continue;

        for (let item of actor.items) {
            if (item.system?.props?.type === "specialty" && 
                item.system?.props?.maxlimit > 0) {
                
                const maxLimit = parseInt(item.system.props.maxlimit);
                const currentLimit = parseInt(item.system.props.limit);
                const limitTerm = item.system.props.limitterm;

                console.log('Checking end of combat recovery:', {
                    name: item.name,
                    maxLimit,
                    currentLimit,
                    limitTerm
                });

                // "씬마다" 또는 현재 값이 최대값보다 작은 경우 회복
                if (limitTerm === "씬마다" || currentLimit < maxLimit) {
                    console.log(`Recovering ${item.name} at end of combat`);
                    await item.update({
                        "system.props.limit": maxLimit
                    });
                }
            }
        }
    }
});
    
        // 상태 효과 초기화
        this._initializeStatusEffects();
    }


            static _initializeStatusEffects() {
                CONFIG.statusEffects = [
                    {
                        id: "pressure",
                        label: "중압",
                        icon: "modules/metalic-combat-system/icons/중압.png"
                    },
                    {
                        id: "failure",
                        label: "낭패",
                        icon: "modules/metalic-combat-system/icons/낭패.png"
                    },
                    {
                        id: "corrosion",
                        label: "침식",
                        icon: "modules/metalic-combat-system/icons/침식.png"
                    },
                    {
                        id: "Capture",
                        label: "포박",
                        icon: "modules/metalic-combat-system/icons/포박.png"
                    },
                    {
                        id: "paralysis",
                        label: "마비",
                        icon: "modules/metalic-combat-system/icons/마비.png"
                    },
                    {
                        id: "absence",
                        label: "방심",
                        icon: "modules/metalic-combat-system/icons/방심.png"
                    },
                    {
                        id: "lossspeed",
                        label: "실속",
                        icon: "modules/metalic-combat-system/icons/실속.png"
                    },
                    {
                        id: "hatred",
                        label: "증오",
                        icon: "modules/metalic-combat-system/icons/증오.png"
                    },
                    {
                        id: "Powerdown",
                        label: "파워다운",
                        icon: "modules/metalic-combat-system/icons/파워.png"
                    },
                    {
                        id: "fly",
                        label: "비행",
                        icon: "modules/metalic-combat-system/icons/비행.png"
                    },
                    {
                        id: "movefast",
                        label: "질주",
                        icon: "modules/metalic-combat-system/icons/질주.png"
                    },
                    {
                        id: "highmovement",
                        label: "고기동",
                        icon: "modules/metalic-combat-system/icons/기동.png"
                    },
                    {
                        id: "inrush",
                        label: "돌입",
                        icon: "modules/metalic-combat-system/icons/돌입.png"
                    },
                    {
                        id: "heatresistance",
                        label: "내열",
                        icon: "modules/metalic-combat-system/icons/내열.png"
                    },
                    {
                        id: "underground",
                        label: "지중",
                        icon: "modules/metalic-combat-system/icons/지중.png"
                    },
                    {
                        id: "break",
                        label: "브레이크",
                        icon: "modules/metalic-combat-system/icons/브레이크.png"
                    },
                    {
                        id: "SS",
                        label: "SS",
                        icon: "modules/metalic-combat-system/icons/SS.png"
                    },
                    {
                        id: "S",
                        label: "S",
                        icon: "modules/metalic-combat-system/icons/S.png"
                    },
                    {
                        id: "M",
                        label: "M",
                        icon: "modules/metalic-combat-system/icons/M.png"
                    },
                    {
                        id: "L",
                        label: "L",
                        icon: "modules/metalic-combat-system/icons/L.png"
                    },
                    {
                        id: "XL",
                        label: "XL",
                        icon: "modules/metalic-combat-system/icons/XL.png"
                    },
                    {
                        id: "mob",
                        label: "몹",
                        icon: "modules/metalic-combat-system/icons/몹.png"
                    },
                    {
                        id: "solo",
                        label: "솔로",
                        icon: "modules/metalic-combat-system/icons/솔로.png"
                    },
                    {
                        id: "strongenemy",
                        label: "강적",
                        icon: "modules/metalic-combat-system/icons/강적.png"
                    }
                ];
                console.log('MCS | 상태 효과 초기화 완료');
            }

    static _overrideInitiative() {
        game.settings.set(game.system.id, 'initFormula', 'init');
        console.log('MCS | Initiative formula changed to @props.init');
    }            
            
    static _registerSettings() {
        // 효과음 볼륨 설정 추가
        game.settings.register(this.ID, "effectVolume", {
            name: "Effect Volume",
            hint: "무기 효과의 볼륨을 설정합니다 (0-1)",
            scope: "client",
            config: true,
            type: Number,
            range: {
                min: 0,
                max: 1,
                step: 0.1
            },
            default: 0.5,
            onChange: value => {
                console.log(`Effect volume changed to ${value}`);
            }
        });
        game.settings.register(this.ID, "damagePermissionLevel", {
            name: "대미지 처리 권한",
            hint: "어느 권한 레벨부터 대미지 처리 기능을 사용할 수 있는지 설정합니다.",
            scope: "world",
            config: true,
            type: String,
            choices: {
                "GAMEMASTER": "게임마스터만",
                "TRUSTED": "신뢰하는 플레이어",
                "PLAYER": "모든 플레이어",
            },
            default: "GAMEMASTER"
        });

        game.settings.register(this.ID, "enableInitiativePhase", {
            name: "전투 프로세스 사용",
            hint: "턴 사이의 이니셔티브 페이즈와 라운드별 셋업/클린업 프로세스를 사용합니다.",
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
            onChange: async (enabled) => {
                if (game.combat) {
                    if (enabled) {
                        await this.createCombatPhases(game.combat);
                    } else {
                        await this.removeCombatPhases(game.combat);
                    }
                }
            }
        });

        game.keybindings.register(this.ID, "toggleActorStatus", {
            name: "토글 액터 상태창",
            hint: "액터 상태창을 켜고 끕니다",
            editable: [
                {
                    key: "KeyA",
                    modifiers: ["Control"]
                }
            ],
            onDown: () => {
                ActorStatusManager.isVisible() ? ActorStatusManager.hide() : ActorStatusManager.show();
            },
            restricted: false,
            precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
        });

        game.settings.register(this.ID, "actorWidgetSettings", {
            name: "액터 상태창 설정",
            hint: "상태창에 표시할 액터들을 설정합니다.",
            scope: "client",
            config: false,
            type: Object,
            default: {}
        });
    
        // 상태창 자동 표시 설정
        game.settings.register(this.ID, "autoShowActorStatus", {
            name: "상태창 자동 표시",
            hint: "게임 시작시 액터 상태창을 자동으로 표시합니다.",
            scope: "client",
            config: true,
            type: Boolean,
            default: true
        });
        
        // 상태창의 기본 위치 설정
        game.settings.register(this.ID, "actorStatusPosition", {
            name: "상태창 위치",
            hint: "상태창의 기본 위치를 설정합니다",
            scope: "client",
            config: false,
            type: Object,
            default: {
                top: 50,
                right: 315
            }
        });
        
        // 체력바 경고 임계값 설정
        game.settings.register(this.ID, "resourceWarningThreshold", {
            name: "자원 경고 임계값",
            hint: "자원이 몇 % 이하일 때 경고를 표시할지 설정합니다",
            scope: "client",
            config: true,
            type: Number,
            range: {
                min: 1,
                max: 100,
                step: 1
            },
            default: 25
        });

        game.settings.register(this.ID, "actorWidgetOrder", {
            name: "액터 표시 순서",
            scope: "client",
            config: false,
            type: Array,
            default: []
        });
    }

    static _exposeAPI() {
        console.log('MCS | Exposing API...');
        const api = {
            CombatManager,
            DefenseManager,
            DiceHelper,
            WeaponEffects,
            StatCheck,
            DamageManager,
            SyncManager,
            TransformationManager,
            ActorStatusManager,
            StatusEffectManager,
            CombatInfoManager,
            TemplateManager
        };    

        Hooks.on('renderChatMessage', (message, html, data) => {
            this._setupChatListeners(html);

            html.find('.specialty-button').click(function(event) {
                const data = event.currentTarget.dataset;
                
                new Dialog({
                    title: `${data.specialtyName} 상세정보`,
                    content: `
                        <style>
                            .specialty-detail {
                                background: #f5f5f5;
                                padding: 15px;
                                border-radius: 8px;
                            }
                            .specialty-info {
                                background: white;
                                padding: 12px;
                                border-radius: 6px;
                                margin-bottom: 10px;
                                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                            }
                            .specialty-header {
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                margin-bottom: 10px;
                            }
                            .info-tag {
                                background: #f8f9fa;
                                padding: 4px 8px;
                                border-radius: 4px;
                                font-size: 12px;
                                color: #666;
                            }
                            .effect-description {
                                margin-top: 10px;
                                padding: 10px;
                                background: #f8f9fa;
                                border-radius: 4px;
                                font-size: 14px;
                                color: #4a4a4a;
                            }
                        </style>
                        <div class="specialty-detail">
                            <div class="specialty-info">
                                <div class="specialty-header">
                                    <h3 style="margin: 0;font-size: 16px;color: #4a4a4a;">
                                        ${data.specialtyName}
                                    </h3>
                                    ${data.specialtyLevel ? `
                                        <span class="info-tag">
                                            LV.${data.specialtyLevel}
                                        </span>
                                    ` : ''}
                                </div>
                                <div style="display: flex;flex-wrap: wrap;gap: 6px;">
                                    ${data.specialtyTiming ? `
                                        <span class="info-tag">${data.specialtyTiming}</span>
                                    ` : ''}
                                    ${data.specialtyTarget ? `
                                        <span class="info-tag">${data.specialtyTarget}</span>
                                    ` : ''}
                                    ${data.specialtyRange ? `
                                        <span class="info-tag">${data.specialtyRange}</span>
                                    ` : ''}
                                    ${data.specialtyCost ? `
                                        <span class="info-tag">${data.specialtyCost}</span>
                                    ` : ''}
                                </div>
                                ${data.specialtyEffect ? `
                                    <div class="effect-description">
                                        ${data.specialtyEffect}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `,
                    buttons: {
                        close: {
                            icon: '<i class="fas fa-times"></i>',
                            label: "닫기"
                        }
                    },
                    default: "close",
                    width: 400
                }).render(true);
            });
        });
        
        window.MetalicCombatSystem = api;
        globalThis.MetalicCombatSystem = api;
        game.modules.get(this.ID).api = api;
    }

    static _setupChatListeners(html) {
        html.find('.defense-controls').each((i, controlDiv) => {
            const button = controlDiv.querySelector('.defense-roll-button');
            if (!button) return;
    
            const targetId = button.dataset.targetId;
            const actorId = button.dataset.actorId;
    
            const targetToken = canvas.tokens.placeables.find(t => t.id === targetId);
            const target = targetToken?.actor || game.actors.get(actorId);
    
            if (!target) return;
    
            const isOwner = target.ownership[game.user.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
            const canDefend = isOwner || game.user.isGM;
    
            if (!canDefend) {
                controlDiv.style.display = "none";
            } else {
                button.onclick = async (event) => {
                    event.preventDefault();
                    console.log('Defense button clicked');
                    
                    const attackRoll = parseInt(button.dataset.attackRoll);
                    const isCritical = button.dataset.isCritical === 'true';
                    const isFumble = button.dataset.isFumble === 'true';
                    const combatDataStr = button.dataset.combatData;
                
                    console.log('Defense parameters:', {
                        targetId,
                        attackRoll,
                        defenseType: controlDiv.querySelector('.defense-type-select').value,
                        modifier: parseInt(controlDiv.querySelector('.defense-modifier').value || 0),
                        isCritical,
                        isFumble,
                        combatDataStr
                    });
                
                    try {
                        if (targetId && !isNaN(attackRoll)) {
                            const defenseType = controlDiv.querySelector('.defense-type-select').value;
                            const modifier = parseInt(controlDiv.querySelector('.defense-modifier').value || 0);
                
                            await DefenseManager.performDefense(
                                targetId, 
                                attackRoll, 
                                defenseType, 
                                modifier, 
                                isCritical,
                                isFumble,
                                combatDataStr
                            );
                            console.log('Defense roll completed');
                            button.disabled = true;
                        }
                    } catch (error) {
                        console.error('Error during defense roll:', error);
                    }
                };
            }
        });
        
        html.find('.stat-check-button').click(async (event) => {
            const button = event.currentTarget;
            const characterId = button.dataset.characterId;
            const statType = button.dataset.statType;
            const modifier = Number(button.dataset.modifier);
        
            await StatCheck.performCheck([characterId], statType, modifier);
            button.disabled = true;
        });
    
    
        // 모든 collapsible 카드를 기본적으로 펼쳐진 상태로 시작
        html.find('.collapsible-card.collapsed').each((i, card) => {
            const content = card.querySelector('.collapsible-content');
            if (content) {
                // 직접 style 적용
                content.style.cssText = 'display: none !important; height: 0 !important; opacity: 0 !important; margin: 0 !important; padding: 0 !important;';
                // 모든 하위 요소들도 숨김
                content.querySelectorAll('*').forEach(el => {
                    // 기존 스타일 저장
                    if (!el.getAttribute('data-original-style')) {
                        el.setAttribute('data-original-style', el.style.cssText);
                    }
                    el.style.cssText = 'display: none !important;';
                });
            }
        });
    
        // 접기/펼치기 헤더에 대한 클릭 이벤트
        html.find('.collapsible-header').each((i, header) => {
            header.addEventListener('click', async (ev) => {
                ev.preventDefault();
                const card = header.closest('.collapsible-card');
                const content = card.querySelector('.collapsible-content');
                
                if (!content) return;
    
                if (card.classList.contains('collapsed')) {
                    // 펼치기
                    card.classList.remove('collapsed');
                    content.style.cssText = '';
                    // 모든 하위 요소들의 style 초기화
                    content.querySelectorAll('*').forEach(el => {
                        el.style.cssText = el.getAttribute('data-original-style') || '';
                    });
                } else {
                    // 접기
                    card.classList.add('collapsed');
                    // 직접 style 적용
                    content.style.cssText = 'display: none !important; height: 0 !important; opacity: 0 !important; margin: 0 !important; padding: 0 !important;';
                    // 모든 하위 요소들도 숨김
                    content.querySelectorAll('*').forEach(el => {
                        // 기존 스타일 저장
                        if (!el.getAttribute('data-original-style')) {
                            el.setAttribute('data-original-style', el.style.cssText);
                        }
                        el.style.cssText = 'display: none !important;';
                    });
                }
            });
        });
    
        // 주사위 굴림 결과 토글 (기존 코드)
        html.find('.dice-roll .dice-total').each((i, diceTotal) => {
            diceTotal.addEventListener('click', ev => {
                ev.currentTarget.parentElement.querySelector('.dice-tooltip')?.classList.toggle('expanded');
            });
        });
        html.find('.damage-roll-button').click(async (event) => {
            const button = event.currentTarget;
            const combatDataStr = button.dataset.combatData;
    
            if (combatDataStr) {
                try {
                    const combatData = JSON.parse(decodeURIComponent(combatDataStr));
                    const attacker = game.actors.get(combatData.attacker.id);
                    const isCritical = combatData.isCritical === true;
                    
                    if (attacker && combatData.weapon) {
                        const hitTargets = [];
                        const targetSections = html.find('.target-section');
                        targetSections.each((i, section) => {
                            if ($(section).text().includes('명중!')) {
                                const name = $(section).find('.collapsible-header span').first().text().replace('대상:', '').trim();
                                if (name) hitTargets.push(name);
                            }
                        });
    
                        await CombatManager.performManualDamageRoll(
                            combatData.weapon,
                            attacker,
                            hitTargets,
                            isCritical
                        );
                    }
                } catch (error) {
                    console.error('Error processing manual damage roll:', error);
                    ui.notifications.error("데미지 처리 중 오류가 발생했습니다.");
                }
            }
            else {
                console.error("combatDataStr is undefined or empty.");
                ui.notifications.error("올바른 데이터가 없습니다.");
            }
        });
    }
    static async createCombatPhases(combat) {
        // 먼저 기존 페이즈들을 모두 제거
        await this.removeCombatPhases(combat);
        
        const phases = [
            {
                name: "셋업 페이즈",
                img: "icons/svg/sun.svg",
                initiative: 1000,
                flags: {
                    metalicCombatSystem: {
                        isPhase: true,
                        phaseType: "setup"
                    }
                }
            },
            {
                name: "이니셔티브 페이즈",
                img: "icons/svg/clockwork.svg",
                initiative: 999,
                flags: {
                    metalicCombatSystem: {
                        isPhase: true,
                        phaseType: "initiative"
                    }
                }
            },
            {
                name: "클린업 페이즈",
                img: "icons/svg/sleep.svg",
                initiative: -1,
                flags: {
                    metalicCombatSystem: {
                        isPhase: true,
                        phaseType: "cleanup"
                    }
                }
            }
        ];
    
        // 한 번에 모든 페이즈 생성
        await combat.createEmbeddedDocuments('Combatant', phases.map(phase => ({
            ...phase,
            tokenId: null,
            actorId: null,
            hidden: false
        })));
    }

    static async removeCombatPhases(combat) {
        const phaseIds = combat.turns
            .filter(t => t.flags?.metalicCombatSystem?.isPhase)
            .map(t => t.id);
        
        if (phaseIds.length) {
            await combat.deleteEmbeddedDocuments('Combatant', phaseIds);
        }
    }
}

// 초기화
Hooks.once('init', () => {
    console.log('MCS | Init hook');
    MetalicCombatSystem.init();
    
    // css로드
    const link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';
    link.href = '/modules/metalic-combat-system/styles/style.css';
    document.getElementsByTagName('head')[0].appendChild(link);
});

// 이니셔티브 공식 변경
Hooks.once('ready', () => {
    console.log('MCS | Ready hook called');
    
    if (game.settings.get(MetalicCombatSystem.ID, 'overrideInitiative')) {
        MetalicCombatSystem._overrideInitiative();
    }

    if (game.dice3d) {
        game.dice3d.messageHookDisabled = false;
    }
})

Hooks.once('socketlib.ready', () => {
    console.log('MCS | socketlib.ready fired');
    
    // 소켓 등록
    MetalicCombatSystem.SOCKET = socketlib.registerModule(MetalicCombatSystem.ID);

    MetalicCombatSystem.SOCKET.register('processTurnChange', async (combatId, data) => {
        if (!game.user.isGM) return;
        
        const combat = game.combats.get(combatId);
        if (!combat) return;
    
        const { isPhase, phaseType, currentTurn } = data;
        
        if (!isPhase) {
            // 일반 턴이 끝날 때 lastRegularTurn 플래그 업데이트
            await combat.setFlag('metalic-combat-system', 'lastRegularTurn', currentTurn);
            
            const phaseTurn = combat.turns.find(t => 
                t.flags?.metalicCombatSystem?.phaseType === "initiative"
            );
            await combat.update({turn: combat.turns.indexOf(phaseTurn)});
            await ChatMessage.create({
                content: `<h2>이니셔티브 페이즈</h2><p>다음 턴에 행동할 캐릭터를 결정합니다.</p>`,
                type: CONST.CHAT_MESSAGE_TYPES.OTHER
            });
        }
    });
    
    // 전투 관련 소켓 핸들러 등록
    MetalicCombatSystem.SOCKET.register('updateCombatFlag', async (combatId, flagKey, flagValue) => {
        if (!game.user.isGM) return;
        const combat = game.combats.get(combatId);
        if (combat) {
            await combat.setFlag('metalic-combat-system', flagKey, flagValue);
        }
    });

    MetalicCombatSystem.SOCKET.register('updateCombatTurn', async (combatId, turnIndex) => {
        if (!game.user.isGM) return;
        const combat = game.combats.get(combatId);
        if (combat) {
            await combat.update({turn: turnIndex});
        }
    });
    
    // 매니저 초기화
    try {
        console.log('Starting manager initialization...');
        
        console.log('Initializing CombatManager...');
        CombatManager.initialize(MetalicCombatSystem.SOCKET);
        
        console.log('Initializing DefenseManager...');
        DefenseManager.initialize(MetalicCombatSystem.SOCKET);
        
        console.log('Initializing StatCheck...');
        StatCheck.initialize(MetalicCombatSystem.SOCKET);
        
        console.log('Initializing DamageManager...');
        DamageManager.initialize(MetalicCombatSystem.SOCKET);
        
        console.log('Initializing SyncManager...');
        SyncManager.initialize(MetalicCombatSystem.SOCKET);
        
        console.log('Initializing ActorStatusManager...');
        const result = ActorStatusManager.initialize(MetalicCombatSystem.SOCKET);
        console.log('ActorStatusManager initialization result:', result);

        console.log('Initializing StatusEffectManager...');
        StatusEffectManager.initialize(MetalicCombatSystem.SOCKET);

        console.log('Initializing CombatInfoManager...');
        CombatInfoManager.initialize(MetalicCombatSystem.SOCKET);

        TemplateManager.initialize(MetalicCombatSystem.SOCKET);

        console.log('ActorStatusManager state after init:', {
            socket: ActorStatusManager.socket,
            window: ActorStatusManager.window,
            initialized: !!ActorStatusManager.socket
        });

    } catch (error) {
        console.error('Error during manager initialization:', error);
    }
});

// 준비 완료 후 확인을 위한 훅 추가
Hooks.once('ready', () => {
    if (!window.MetalicCombatSystem) {
        console.error('Metalic Combat System | API not found on window object');
    } else {
        console.log('Metalic Combat System | API registered successfully');
    }
});

Hooks.once('ready', async () => {
    console.log('MCS | Ready hook fired');
    
    // ActorStatusManager 상태 확인
    console.log('ActorStatusManager state at ready:', {
        socket: ActorStatusManager.socket,
        window: ActorStatusManager.window,
        initialized: !!ActorStatusManager.socket
    });

    if (game.settings.get('metalic-combat-system', 'autoShowActorStatus')) {
        console.log('Attempting to show ActorStatusManager...');
        try {
            await ActorStatusManager.show();
            console.log('ActorStatusManager.show() completed');
        } catch (error) {
            console.error('Error showing ActorStatusManager:', error);
        }
    }
});

// 게임 설정 등록
Hooks.once('setup', () => {
    console.log('MCS | Setup hook fired');
    console.log('socketlib status:', !!window.socketlib);
});

// 핫바 매크로 드롭 처리
Hooks.once('ready', () => {
    console.log('MCS | Ready hook fired');
    console.log('socketlib status:', !!window.socketlib);
    if (!window.socketlib) {
        console.error('socketlib not found at ready!');
    }
});

Hooks.on('diceSoNiceRollComplete', (messageId) => {
    // 주사위 굴림이 완료된 후 무기 효과 재생
    if (window.pendingWeaponEffect) {
        window.pendingWeaponEffect();
        window.pendingWeaponEffect = null;
    }
});

game.MetalicCombatSystem = {
    toggleActorStatus: () => {
        if (ActorStatusManager.isVisible()) {
            ActorStatusManager.hide();
        } else {
            ActorStatusManager.show();
        }
    }
};

Hooks.once('ready', async function() {
    if (!game.user.isGM) return;
    
    const initialized = game.settings.get('metalic-combat-system', 'initialized');
    if (initialized) return;
 
    try {
        console.log('Starting template initialization...');
        let itemTemplateFolder = game.folders.find(f => 
            f.name === "아이템 템플릿(수정하지 마세요)" && f.type === "Item"
        );
        let actorTemplateFolder = game.folders.find(f => 
            f.name === "액터 템플릿(수정하지 마세요)" && f.type === "Actor"
        );
 
        if (!itemTemplateFolder) {
            itemTemplateFolder = await Folder.create({
                name: "아이템 템플릿(수정하지 마세요)",
                type: "Item"
            });
        }
 
        if (!actorTemplateFolder) {
            actorTemplateFolder = await Folder.create({
                name: "액터 템플릿(수정하지 마세요)",
                type: "Actor"
            });
        }
 
        const templateIds = {
            class: null,
            'guardian-equipment': null, // Changed from equipment
            weapon: null,
            specialty: null,
            option: null,
            item: null,
            bless: null
        };
 
        const templates = [
            { type: 'class', file: 'class.json' },
            { type: 'guardian-equipment', file: 'guardian(equipment).json' }, // Updated filename
            { type: 'weapon', file: 'weapon.json' },
            { type: 'specialty', file: 'specialty.json' },
            { type: 'option', file: 'option.json' },
            { type: 'item', file: 'item.json' },
            { type: 'bless', file: 'bless.json' }
        ];
 
        for (const template of templates) {
            try {
                const response = await fetch(`/modules/metalic-combat-system/data/${template.file}`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                
                const existingItem = game.items.find(i => i.name === data.name);
                if (!existingItem) {
                    const newItem = await Item.create({
                        ...data,
                        folder: itemTemplateFolder.id
                    });
                    templateIds[template.type] = newItem._id;
                } else {
                    templateIds[template.type] = existingItem._id;
                }
            } catch (error) {
                console.error(`Error creating ${template.type} template:`, error);
            }
        }
 
        const actorPaths = {
            'guardian.json': {
                class: 'header.contents[1].contents[0].contents[1].contents[0].contents[0].contents[0]',
                'guardian-equipment': 'header.contents[1].contents[0].contents[1].contents[0].contents[1].contents[0]',
                weapon: 'header.contents[1].contents[0].contents[1].contents[0].contents[2].contents[0]',
                specialty: 'header.contents[1].contents[0].contents[1].contents[0].contents[3].contents[0]',
                option: 'header.contents[1].contents[0].contents[1].contents[0].contents[4].contents[0]',
                item: 'header.contents[1].contents[0].contents[1].contents[0].contents[5].contents[0]',
                bless: 'header.contents[1].contents[0].contents[1].contents[1]'
            },
            'pilot.json': {
                class: 'header.contents[1].contents[1].contents[1].contents[0].contents[0].contents[0]',
                weapon: 'header.contents[1].contents[1].contents[1].contents[0].contents[1].contents[0]',
                specialty: 'header.contents[1].contents[1].contents[1].contents[0].contents[2].contents[0]',
                item: 'header.contents[1].contents[1].contents[1].contents[0].contents[3].contents[0]',
                bless: 'header.contents[1].contents[1].contents[1].contents[1]'
            },
            'enemy.json': {
                weapon: 'header.contents[1].contents[0].contents[1].contents[0].contents[0].contents[0]',
                specialty: 'header.contents[1].contents[0].contents[1].contents[0].contents[1].contents[0]'
            }
        };
 
        const getObjectAtPath = (obj, path) => {
            return path.split('.').reduce((o, p) => {
                if (p.includes('[') && p.includes(']')) {
                    const prop = p.split('[')[0];
                    const index = parseInt(p.split('[')[1].split(']')[0]);
                    return o?.[prop]?.[index];
                }
                return o?.[p];
            }, obj);
        };
 
        for (const [actorFile, paths] of Object.entries(actorPaths)) {
            try {
                console.log(`Processing ${actorFile}...`);
                const response = await fetch(`/modules/metalic-combat-system/data/${actorFile}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const actorData = await response.json();
 
                for (const [type, path] of Object.entries(paths)) {
                    if (templateIds[type]) {
                        const container = getObjectAtPath(actorData.system, path);
                        if (container) {
                            console.log(`Updating ${type} templateFilter in ${actorFile} from:`, container.templateFilter);
                            container.templateFilter = [templateIds[type]];
                            console.log(`Updated to:`, container.templateFilter);
                        } else {
                            console.warn(`Container not found for ${type} in ${actorFile} at path: ${path}`);
                        }
                    }
                }
 
                const existingActor = game.actors.find(a => a.name === actorData.name);
                if (!existingActor) {
                    const newActor = await Actor.create({
                        ...actorData,
                        folder: actorTemplateFolder.id
                    });
                    console.log(`Created actor template: ${newActor.name}`);
                } else {
                    console.log(`Actor template already exists: ${actorData.name}`);
                }
 
            } catch (error) {
                console.error(`Error processing actor ${actorFile}:`, error);
                ui.notifications.warn(`Failed to process actor: ${actorFile}`);
            }
        }
 
        await game.settings.set('metalic-combat-system', 'initialized', true);
        ui.notifications.info("Template initialization completed.");
 
    } catch (error) {
        console.error("Error during initialization:", error);
        ui.notifications.error("Template initialization failed.");
    }
 });

// 초기화 설정 등록
Hooks.once('init', () => {
    game.settings.register('metalic-combat-system', 'initialized', {
        name: 'Initialization Status',
        scope: 'world',
        config: false,
        type: Boolean,
        default: false
    });

    // 초기화 리셋 명령어 추가
    game.settings.register('metalic-combat-system', 'resetInitialization', {
        name: '초기화 재설정',
        hint: '템플릿 생성을 다시 실행할 수 있도록 초기화 상태를 재설정합니다',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        onChange: value => {
            if (value) {
                game.settings.set('metalic-combat-system', 'initialized', false);
                game.settings.set('metalic-combat-system', 'resetInitialization', false);
                ui.notifications.info("Template initialization has been reset.");
            }
        }
    });
});
// =======================================================================
// ★★★★★ 채팅 카드 상호작용 기능 활성화 (오류 수정 최종 버전) ★★★★★
// =======================================================================

/**
 * 채팅 로그에 렌더링된 모든 메시지에 대해 이벤트 리스너를 활성화합니다.
 * @param {ChatMessage} message - 렌더링된 채팅 메시지 객체
 * @param {jQuery} html - 메시지의 HTML 요소
 * @param {object} data - 메시지 데이터
 */
const activateChatListeners = (message, html, data) => {
    // 접기/펴기 기능 (Collapsible)
    html.find('.mcs-collapsible-header').on('click', event => {
        event.preventDefault();
        const header = $(event.currentTarget);
        const card = header.closest('.mcs-collapsible-card');
        card.toggleClass('collapsed');
    });

    // 방어 굴림 버튼 기능
    html.find('.mcs-defense-button').on('click', async event => {
        event.preventDefault();
        console.log('--- [MCS DEBUG] Defense Button Clicked ---'); // 디버깅 로그 추가

        const button = $(event.currentTarget);
        const controlGroup = button.closest('.mcs-defense-controls'); // 버튼이 속한 그룹 찾기

        const targetId = button.data('targetId');
        const attackRoll = button.data('attackRoll');
        const isCritical = button.data('isCritical');
        const isFumble = button.data('isFumble');
        const combatData = button.data('combatData');

        const defenseType = controlGroup.find('.mcs-defense-select').val();
        const modifier = parseInt(controlGroup.find('.mcs-defense-modifier').val()) || 0;

        // 디버깅: 전달할 데이터 확인
        console.log('[MCS DEBUG] Event Listener Data:', {
            targetId,
            attackRoll,
            defenseType,
            modifier,
            isCritical,
            isFumble,
            combatData: decodeURIComponent(combatData)
        });

        if (!targetId || isNaN(attackRoll)) {
            console.error('[MCS DEBUG] Critical data missing!', { targetId, attackRoll });
            return;
        }

        await DefenseManager.performDefense(
            targetId,
            attackRoll,
            defenseType,
            modifier,
            isCritical,
            isFumble,
            combatData
        );
        console.log('--- [MCS DEBUG] DefenseManager.performDefense() Called ---');
    });
};

// Foundry VTT의 핵심 Hook: 채팅 메시지가 화면에 그려질 때마다 위의 함수를 실행
Hooks.on('renderChatMessage', activateChatListeners);

