export class TransformationManager {
    static socket = null;

    static initialize(socketlib) {
        if (!socketlib) {
            console.error('[TransformationManager] No socketlib provided');
            return false;
        }

        try {
            this.socket = socketlib;
            this.socket.register('updateCombatantAsGM', this._updateCombatantAsGM.bind(this));
            console.log('[TransformationManager] Socket initialized');
            return true;
        } catch (error) {
            console.error('[TransformationManager] Initialization error:', error);
            return false;
        }
    }

    static async _updateCombatantAsGM(combatantId, updateData) {
        if (!game.user.isGM) return;
        
        try {
            const combatant = game.combat.combatants.get(combatantId);
            if (!combatant) {
                console.error('Combatant not found:', combatantId);
                return;
            }
            
            await combatant.update(updateData);
        } catch (error) {
            console.error('Error updating combatant:', error);
            ui.notifications.error("컴뱃턴트 업데이트 중 오류가 발생했습니다.");
        }
    }

    static async performTransformation(selectedToken, guardianId) {
        const guardian = game.actors.get(guardianId);
        if (!guardian) {
            ui.notifications.error("가디언을 찾을 수 없습니다.");
            return;
        }
    
        try {
            const currentActor = selectedToken.actor;
            
            // 변신 시각 효과 재생
            if (game.modules.get('sequencer')?.active) {
                new Sequence()
                    .effect()
                    .file("jb2a.impact.007.blue")
                    .atLocation(selectedToken)
                    .scale(0.5)
                    .wait(500) // 500ms 대기
                    .effect()
                    .file("jb2a.static_electricity.03.orange")
                    .atLocation(selectedToken)
                    .scale(0.5)
                    .wait(500) // 500ms 대기
                    .effect()
                    .file("jb2a.impact.012.blue")
                    .atLocation(selectedToken)
                    .scale(0.5)
                    .play();
            }
    
            // 현재 값과 최대값 동기화 계산
            const newStats = {
                "system.props.fpvalue": Math.min(
                    currentActor.system.props.fpvalue || 0, 
                    guardian.system.props.fpmax || 0
                ),
                "system.props.hpvalue": Math.min(
                    currentActor.system.props.hpvalue || 0, 
                    guardian.system.props.hpmax || 0
                ),
                "system.props.envalue": Math.min(
                    currentActor.system.props.envalue || 0, 
                    guardian.system.props.enmax || 0
                )
            };
    
            // 효과가 끝나길 기다린 후 토큰 업데이트
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5초 대기
    
            // 토큰 업데이트
            await selectedToken.document.update({
                actorId: guardianId,
                name: guardian.name,
                texture: {
                    src: guardian.img
                }
            });
    
            // 스탯 동기화
            await guardian.update(newStats);
    
            // 전투 중인 경우 컴뱃턴트 업데이트
            if (game.combat?.started) {
                const combatant = game.combat.combatants.find(c => 
                    c.tokenId === selectedToken.id
                );
                if (combatant) {
                    await this.socket.executeAsGM('updateCombatantAsGM', 
                        combatant.id, 
                        {
                            img: guardian.img,
                            initiative: guardian.system.props.init || 0
                        }
                    );
                }
            }
    
            ui.notifications.info(`${guardian.name}으로 변신했습니다!`);
            
            // 변신 효과음 재생
            if (game.modules.get('dice-so-nice')?.active) {
                AudioHelper.play({
                    src: "sounds/transformation.wav", 
                    volume: 0.8,
                    autoplay: true,
                    loop: false
                });
            }
    
        } catch (error) {
            console.error("변신 중 오류 발생:", error);
            ui.notifications.error("변신 중 오류가 발생했습니다.");
        }
    }
}