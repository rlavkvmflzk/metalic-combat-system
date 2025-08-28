// damageManager.js
export class DamageManager {
    static socket = null;

    static initialize(socketlib) {
        if (!socketlib) {
            console.error('[DamageManager] No socketlib provided');
            return false;
        }
    
        try {
            this.socket = socketlib;
            // applyDamage 핸들러 등록 추가
            this.socket.register('applyDamage', this._handleDamageApplication.bind(this));
            console.log('[DamageManager] Successfully initialized with socketlib');
            return true;
        } catch (error) {
            console.error('[DamageManager] Initialization error:', error);
            return false;
        }
    }
    
    // GM이 실행할 대미지 적용 핸들러 추가
    static async _handleDamageApplication(data) {
        const { tokenId, updates } = data;
        const token = canvas.tokens.get(tokenId);
        
        if (!token) return;
        
        try {
            await token.actor.update(updates);
        } catch (error) {
            console.error('Error applying damage:', error);
        }
    }
    

    static weaponTypeKorean = {
        melee: "백병",
        ranged: "사격",
        artillery: "원격",
        heal: "회복"
    };

    static damageTypeKorean = {
        slash: "참격",
        pierce: "관통",
        bludge: "타격",
        fire: "화염",
        ice: "얼음",
        lightning: "번개",
        light: "빛",
        dark: "어둠",
        신: "신",
        노래: "노래"
    };

    static async getLatestDamageInfo() {
        const messages = game.messages.contents.slice(-20);
        
        let damageInfo = null;
        let weaponTypeInfo = null;
        let isArmorIgnore = false;
        let isSniping = false;
        let isCritical = false;
        
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const content = message.content;
            
            // 크리티컬 체크
            if (content.includes('크리티컬!')) {
                isCritical = true;
            }
            
            // 대미지 메시지 찾기
            if (!damageInfo && content.includes('- 최종 데미지')) {
                console.log('Found damage message');
                const damageMatch = content.match(/<span[^>]*style=["'][^"']*background:\s*#dc3545[^"']*["'][^>]*>\s*(\d+)\s*<\/span>/);
                if (damageMatch) {
                    damageInfo = parseInt(damageMatch[1]);
                    console.log('Found damage:', damageInfo);
                }
            }
            
            // 무기 타입과 대미지 타입 정보 찾기
            if (!weaponTypeInfo && content.includes('multi-attack-roll')) {
                console.log('Found attack roll message');
                
                // 방어관통 체크
                isArmorIgnore = content.includes('방어관통');
                
                // 저격 체크
                isSniping = content.includes('저격');
                
                const spans = content.match(/background:#f8f9fa[^>]*?color:#666[^>]*?>\s*([^<]+?)\s*</g);
                if (spans) {
                    let weaponType = 'melee';
                    let damageType = 'slash';
                    
                    for (const span of spans) {
                        const text = span.match(/>\s*([^<]+?)\s*</)[1];
                        
                        if (text.includes('원격') || text.includes('포격')) {
                            weaponType = 'artillery';
                        } else if (text.includes('사격')) {
                            weaponType = 'ranged';
                        }
                        
                        if (text.includes('관통')) damageType = 'pierce';
                        else if (text.includes('타격')) damageType = 'bludge';
                        else if (text.includes('화염')) damageType = 'fire';
                        else if (text.includes('얼음')) damageType = 'ice';
                        else if (text.includes('번개')) damageType = 'lightning';
                        else if (text.includes('빛')) damageType = 'light';
                        else if (text.includes('어둠')) damageType = 'dark';
                        else if (text.includes('신')) damageType = '신';
                        else if (text.includes('노래')) damageType = '노래';
                    }
                    
                    weaponTypeInfo = { weaponType, damageType };
                }
            }
            
            if (damageInfo && weaponTypeInfo) {
                return {
                    damage: damageInfo,
                    weaponType: weaponTypeInfo.weaponType,
                    damageType: weaponTypeInfo.damageType,
                    isArmorIgnore,
                    isSniping,
                    isCritical
                };
            }
        }
        
        if (damageInfo) {
            return {
                damage: damageInfo,
                weaponType: 'melee',
                damageType: 'slash',
                isArmorIgnore: false,
                isSniping: false,
                isCritical: false
            };
        }
        
        return null;
    }

    static getDefenseAndBarrier(actor) {
        let props = actor.system.props;
        return {
            defense: {
                slash: props.totalslashdef,
                pierce: props.totalpiercedef,
                bludge: props.totalbludgedef,
                fire: props.totalfiredef,
                ice: props.totalicedef,
                lightning: props.totallightningdef,
                light: props.totallightdef,
                dark: props.totaldarkdef
            },
            barrier: {
                slash: props.totalslashbar,
                pierce: props.totalpiercebar,
                bludge: props.totalbludgebar,
                fire: props.totalfirebar,
                ice: props.totalicebar,
                lightning: props.totallightningbar,
                light: props.totallightbar,
                dark: props.totaldarkbar
            }
        };
    }

    static calculateDamage(damageType, baseDamage, weaponType, actor, defense, barrier, isArmorIgnore = false, isSniping = false, isCritical = false) {
        // 계산 과정을 저장할 객체
        let calculation = {
            baseDamage,
            defense: defense[damageType],
            barrier: barrier[damageType],
            finalDamage: baseDamage,
            steps: []
        };
    
        // 회복일 경우
        if (weaponType === "heal") {
            calculation.steps.push(`회복 효과: ${baseDamage}`);
            return { value: baseDamage, calculation };
        }
    
        // 신성 대미지
        if (damageType === "신") {
            calculation.steps.push(`신성 대미지: ${baseDamage} (방어력/배리어 무시)`);
            return { value: baseDamage, calculation };
        }
    
        // 노래 대미지
        if (damageType === "노래") {
            if (actor.system.guardiantype === "나락수") {
                calculation.steps.push(`노래 대미지: ${baseDamage} (나락수 대상)`);
                return { value: baseDamage, calculation };
            }
            calculation.steps.push(`노래 대미지: 0 (나락수가 아닌 대상)`);
            return { value: 0, calculation };
        }
    
        // 방어관통이거나 저격+크리티컬인 경우
        if (isArmorIgnore || (isSniping && isCritical)) {
            let reason = isArmorIgnore ? "방어관통" : "저격 크리티컬";
            calculation.steps.push(`${reason}으로 인한 방어력/배리어 무시`);
            return { value: baseDamage, calculation };
        }
    
        // 방어력 적용
        calculation.finalDamage -= defense[damageType];
        calculation.steps.push(`방어력 적용: ${baseDamage} - ${defense[damageType]} = ${calculation.finalDamage}`);
    
        // 원거리 공격일 경우 배리어 추가 적용
        if (weaponType === "ranged" || weaponType === "artillery") {
            calculation.finalDamage -= barrier[damageType];
            calculation.steps.push(`배리어 적용: ${calculation.finalDamage} - ${barrier[damageType]} = ${Math.max(0, calculation.finalDamage)}`);
        }
    
        calculation.finalDamage = Math.max(0, calculation.finalDamage);
        
        return { 
            value: calculation.finalDamage, 
            calculation 
        };
    }

    static async handleDamageApplication(html) {
        if (!this.hasPermission()) {
            ui.notifications.error("대미지 처리 권한이 없습니다.");
            return;
        }
    
        const targetTokens = this.getTargetTokens();
        if (targetTokens.length === 0) {
            ui.notifications.error("토큰을 선택하거나 타겟으로 지정하세요.");
            return;
        }
    
        // 모든 필요한 값들을 먼저 수집
        const weaponType = html.find('#weapon-type').val();
        const damageType = html.find('#damage-type').val();
        const baseDamage = parseInt(html.find('#base-damage').val());
        
        const reduceFP = html.find('#reduce-fp').is(':checked');
        const reduceHP = html.find('#reduce-hp').is(':checked');
        const reduceEN = html.find('#reduce-en').is(':checked');
        
        const rawFPDamage = parseInt(html.find('#fp-damage').val()) || baseDamage;
        const rawHPDamage = parseInt(html.find('#hp-damage').val()) || baseDamage;
        const rawENDamage = parseInt(html.find('#en-damage').val()) || baseDamage;
    
        const isHealing = weaponType === "heal";
        const damageMultiplier = isHealing ? -1 : 1;
    
        // 새로운 옵션들
        const isArmorIgnore = html.find('#armor-ignore').is(':checked');
        const isSniping = html.find('#sniping').is(':checked');
        const isCritical = html.find('#critical').is(':checked');
    
        let chatContent = `
            <div class="mcs-card">
            <div style="background: #f5f5f5; border-radius: 8px; padding: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color: #4a4a4a; border-bottom: 2px solid #4a4a4a; padding-bottom: 8px; margin-bottom: 15px;">
                    ${isHealing ? "회복 결과" : "대미지 결과"}
                </h2>
        `;
    
        for (const token of targetTokens) {
            const { defense, barrier } = this.getDefenseAndBarrier(token.actor);
            
            let finalFPDamage = 0;
            let damageCalculation = null;
    
            if (reduceFP) {
                if (isHealing) {
                    finalFPDamage = rawFPDamage * damageMultiplier;
                } else {
                    const damageResult = this.calculateDamage(
                        damageType, 
                        rawFPDamage, 
                        weaponType, 
                        token.actor, 
                        defense, 
                        barrier,
                        isArmorIgnore,
                        isSniping,
                        isCritical
                    );
                    finalFPDamage = damageResult.value * damageMultiplier;
                    damageCalculation = damageResult.calculation;
                }
            }
    
            // 업데이트할 데이터 준비
            const updates = {};
            if (reduceFP) {
                updates["system.props.fpvalue"] = token.actor.system.props.fpvalue - finalFPDamage;
            }
            if (reduceHP) {
                updates["system.props.hpvalue"] = token.actor.system.props.hpvalue - finalHPDamage;
            }
            if (reduceEN) {
                updates["system.props.envalue"] = token.actor.system.props.envalue - finalENDamage;
            }
    
            // 소켓을 통해 대미지 적용
            if (Object.keys(updates).length > 0) {
                await this.socket.executeAsGM('applyDamage', {
                    tokenId: token.id,
                    updates: updates
                });
            }
            
    
            chatContent += `
            <div style="background: white; border-radius: 6px; padding: 12px; margin-bottom: 10px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center; margin-bottom: 8px;">
                    <img src="${token.document.texture.src}" style="width: 40px; height: 40px; border-radius: 50%; border: 2px solid #4a4a4a;">
                    <h3 style="margin: 0; color: #4a4a4a;">${token.name}</h3>
                </div>
                ${(!isHealing && reduceFP) ? `
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; font-size: 0.9em;">
                        <div style="background: #f0f0f0; padding: 6px; border-radius: 4px;">
                            <strong>무기 종류:</strong> ${this.weaponTypeKorean[weaponType]}
                        </div>
                        <div style="background: #f0f0f0; padding: 6px; border-radius: 4px;">
                            <strong>대미지 속성:</strong> ${this.damageTypeKorean[damageType]}
                        </div>
                    </div>
                ` : ''}
                <div style="margin-top: 10px; padding: 10px; background: #f9f9f9; border-radius: 4px;">
                    ${(!isHealing && reduceFP) ? `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="color: #666;">기본 ${isHealing ? "회복량" : "대미지"}</span>
                            <span style="font-weight: bold;">${rawFPDamage}</span>
                        </div>
                        ${(isArmorIgnore || (isSniping && isCritical)) ? `
                            <div style="background: #dc3545; color: white; padding: 4px 8px; border-radius: 4px; margin: 4px 0; text-align: center;">
                                ${isArmorIgnore ? '방어관통' : '저격 크리티컬'} - 방어력/배리어 무시
                            </div>
                        ` : ''}
                        ${(!isHealing && damageCalculation) ? `
                            <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
                                <div style="font-weight: bold; color: #666; margin-bottom: 4px;">계산 과정:</div>
                                ${damageCalculation.steps.map(step => `
                                    <div style="color: #666; font-size: 0.9em; padding: 2px 0;">
                                        ${step}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    ` : ''}
                </div>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 10px;">
                    <div style="text-align: center; padding: 6px; border-radius: 4px; 
                        ${reduceFP ? `background: ${isHealing ? '#28a745' : '#dc3545'}; color: white;` : 'background: #f0f0f0;'}">
                        FP: ${reduceFP ? `${isHealing ? '+' : '-'}${Math.abs(finalFPDamage)}` : '미적용'}
                    </div>
                    <div style="text-align: center; padding: 6px; border-radius: 4px; 
                        ${reduceHP ? `background: ${isHealing ? '#28a745' : '#dc3545'}; color: white;` : 'background: #f0f0f0;'}">
                        HP: ${reduceHP ? `${isHealing ? '+' : '-'}${Math.abs(finalHPDamage)}` : '미적용'}
                    </div>
                    <div style="text-align: center; padding: 6px; border-radius: 4px; 
                        ${reduceEN ? `background: ${isHealing ? '#28a745' : '#dc3545'}; color: white;` : 'background: #f0f0f0;'}">
                        EN: ${reduceEN ? `${isHealing ? '+' : '-'}${Math.abs(finalENDamage)}` : '미적용'}
                    </div>
                </div>
            </div>
        `;
        }
        
        chatContent += '</div></div>';
    
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker(),
            content: chatContent
        });
    }

    static hasPermission() {
        const permissionLevel = game.settings.get("metalic-combat-system", "damagePermissionLevel");
        
        switch (permissionLevel) {
            case "GAMEMASTER":
                return game.user.isGM;
            case "TRUSTED":
                return game.user.isGM || game.user.isTrusted;
            case "PLAYER":
                return true;
            default:
                return game.user.isGM;
        }
    }

    static getTargetTokens() {
        const targets = game.user.targets;
        if (targets.size > 0) {
            return Array.from(targets);
        }
        return canvas.tokens.controlled;
    }

// damageManager.js의 showDamageDialog 메서드 수정
static async showDamageDialog() {
    if (!this.hasPermission()) {
        ui.notifications.error("대미지 처리 권한이 없습니다.");
        return;
    }

    const targetTokens = this.getTargetTokens();
    if (targetTokens.length === 0) {
        ui.notifications.error("토큰을 선택하거나 타겟으로 지정하세요.");
        return;
    }

    const lastDamageInfo = await this.getLatestDamageInfo();

    // lastDamageInfo에서 값들을 추출하거나 기본값 사용
    const isArmorIgnore = lastDamageInfo?.isArmorIgnore || false;
    const isSniping = lastDamageInfo?.isSniping || false;
    const isCritical = lastDamageInfo?.isCritical || false;

    // 타겟 정보 추가
    const targetInfo = targetTokens.map(token => `
        <div style="display: flex; align-items: center; gap: 8px; margin: 4px 0;">
            <img src="${token.document.texture.src}" style="width: 24px; height: 24px; border-radius: 50%;">
            <span>${token.name}</span>
        </div>
    `).join('');
    
    new Dialog({
        title: "대미지 처리",
        content: `
            <style>
                .damage-dialog {
                    background: #f0f0f0;
                    padding: 20px;
                    border-radius: 10px;
                }
                .damage-dialog .option-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .damage-dialog .option-section {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    height: auto;
                    min-height: 110px;
                }
                .damage-dialog .option-section h3 {
                    margin: 0 0 10px 0;
                    color: #4a4a4a;
                    border-bottom: 2px solid #4a4a4a;
                    padding-bottom: 5px;
                }
                .damage-dialog select {
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    background: white;
                    margin-top: 5px;
                    height: auto;
                    min-height: 35px;
                }
                .damage-dialog .damage-section {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .damage-dialog .stat-group {
                    margin-top: 15px;
                }
                .damage-dialog .damage-row {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: 10px;
                    align-items: center;
                    padding: 8px;
                    border-radius: 6px;
                    background: #f8f9fa;
                    margin-bottom: 8px;
                }
                .damage-dialog .damage-row:hover {
                    background: #f0f0f0;
                }
                .damage-dialog .damage-row label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #4a4a4a;
                    font-weight: 500;
                }
                .damage-dialog .damage-row input[type="number"] {
                    padding: 4px 8px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    width: 100px;
                }
                .damage-dialog .stat-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 14px;
                    font-weight: bold;
                }
                .damage-dialog .fp-label { color: #2c7be5; }
                .damage-dialog .hp-label { color: #dc3545; }
                .damage-dialog .en-label { color: #6c757d; }
                .damage-dialog .option-buttons {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 8px;
                    margin-top: 10px;
                    padding: 8px;
                    background: #f8f9fa;
                    border-radius: 6px;
                }
                .damage-dialog .option-button {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .damage-dialog .option-button:hover {
                    background: #f0f0f0;
                }
                .damage-dialog .option-button input[type="checkbox"] {
                    margin: 0;
                }
            </style>
            <div class="damage-dialog">
                <div class="target-section" style="margin-bottom: 15px;">
                    <h3 style="margin-bottom: 10px;">대상</h3>
                    ${targetInfo}
                </div>
                <div class="option-grid">
                    <div class="option-section">
                        <h3>무기 종류</h3>
                        <select id="weapon-type">
                            <option value="melee" ${lastDamageInfo?.weaponType === 'melee' ? 'selected' : ''}>백병</option>
                            <option value="ranged" ${lastDamageInfo?.weaponType === 'ranged' ? 'selected' : ''}>사격</option>
                            <option value="artillery" ${lastDamageInfo?.weaponType === 'artillery' ? 'selected' : ''}>원격</option>
                            <option value="heal">회복</option>
                        </select>
                    </div>
                    <div class="option-section">
                        <h3>대미지 타입</h3>
                        <select id="damage-type">
                            <option value="slash" ${lastDamageInfo?.damageType === 'slash' ? 'selected' : ''}>참격</option>
                            <option value="pierce" ${lastDamageInfo?.damageType === 'pierce' ? 'selected' : ''}>관통</option>
                            <option value="bludge" ${lastDamageInfo?.damageType === 'bludge' ? 'selected' : ''}>타격</option>
                            <option value="fire" ${lastDamageInfo?.damageType === 'fire' ? 'selected' : ''}>화염</option>
                            <option value="ice" ${lastDamageInfo?.damageType === 'ice' ? 'selected' : ''}>얼음</option>
                            <option value="lightning" ${lastDamageInfo?.damageType === 'lightning' ? 'selected' : ''}>번개</option>
                            <option value="light" ${lastDamageInfo?.damageType === 'light' ? 'selected' : ''}>빛</option>
                            <option value="dark" ${lastDamageInfo?.damageType === 'dark' ? 'selected' : ''}>어둠</option>
                            <option value="신" ${lastDamageInfo?.damageType === '신' ? 'selected' : ''}>신</option>
                            <option value="노래" ${lastDamageInfo?.damageType === '노래' ? 'selected' : ''}>노래</option>
                        </select>
                    </div>
                </div>
                <div class="damage-section">
                    <h3>기본 대미지</h3>
                    <input type="number" id="base-damage" value="${lastDamageInfo?.damage || 0}" 
                        style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px;">
                    
                    <div class="option-buttons">
                        <label class="option-button">
                            <input type="checkbox" id="armor-ignore" ${isArmorIgnore ? 'checked' : ''}>
                            <span>방어관통</span>
                        </label>
                        <label class="option-button">
                            <input type="checkbox" id="sniping" ${isSniping ? 'checked' : ''}>
                            <span>저격</span>
                        </label>
                        <label class="option-button">
                            <input type="checkbox" id="critical" ${isCritical ? 'checked' : ''}>
                            <span>크리티컬</span>
                        </label>
                    </div>

                    <div class="stat-group">
                        <div class="damage-row">
                            <label>
                                <input type="checkbox" id="reduce-fp" checked>
                                <span class="stat-label fp-label">FP</span>
                            </label>
                            <span style="color: #666; font-size: 0.9em">데미지</span>
                            <input type="number" id="fp-damage" class="damage-input">
                        </div>
                        <div class="damage-row">
                            <label>
                                <input type="checkbox" id="reduce-hp">
                                <span class="stat-label hp-label">HP</span>
                            </label>
                            <span style="color: #666; font-size: 0.9em">데미지</span>
                            <input type="number" id="hp-damage" class="damage-input">
                        </div>
                        <div class="damage-row">
                            <label>
                                <input type="checkbox" id="reduce-en">
                                <span class="stat-label en-label">EN</span>
                            </label>
                            <span style="color: #666; font-size: 0.9em">데미지</span>
                            <input type="number" id="en-damage" class="damage-input">
                        </div>
                    </div>
                </div>
            </div>
        `,
        buttons: {
            apply: {
                icon: '<i class="fas fa-check"></i>',
                label: "적용",
                callback: (html) => this.handleDamageApplication(html)
            }
        },
        default: "apply",
        width: 400,
        render: (html) => {
            const baseDamageInput = html.find('#base-damage');
            const damageInputs = html.find('.damage-input');

            // 기본 대미지 값이 변경될 때
            baseDamageInput.change(function() {
                const baseValue = $(this).val();
                // 체크된 입력란에만 기본값 설정
                damageInputs.each(function() {
                    if ($(this).prop('disabled') === false) {
                        $(this).val(baseValue);
                    }
                });
            });

            // 체크박스 상태가 변경될 때
            html.find('input[type="checkbox"]').change(function() {
                const damageInput = $(this).closest('.damage-row').find('.damage-input');
                damageInput.prop('disabled', !this.checked);
                if (this.checked) {
                    damageInput.val(baseDamageInput.val());
                } else {
                    damageInput.val('');
                }
            });

            // 초기 상태 설정
            html.find('input[type="checkbox"]').each(function() {
                const damageInput = $(this).closest('.damage-row').find('.damage-input');
                damageInput.prop('disabled', !this.checked);
                if (this.checked) {
                    damageInput.val(baseDamageInput.val());
                }
            });
        }
    }).render(true);
}
}