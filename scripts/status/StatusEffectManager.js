export class StatusEffectManager {
    static ID = 'metalic-combat-system';
    static socket = null;

    static initialize(socketlib) {
        if (!socketlib) {
            console.error('[StatusEffectManager] No socketlib provided');
            return false;
        }

        try {
            this.socket = socketlib;
            this._registerSocketHandlers();
            return true;
        } catch (error) {
            console.error('[StatusEffectManager] Initialization error:', error);
            return false;
        }
    }

    static _registerSocketHandlers() {
        this.socket.register('toggleEffect', this._handleToggleEffect.bind(this));
    }

    // 상태 효과 아이콘 HTML 생성
    static createEffectIconsHTML(actor) {
        // 토큰의 활성화된 효과만 가져오기
        const token = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
        if (!token) return '<div class="status-effects-container"></div>';
    
        const activeEffects = CONFIG.statusEffects.filter(e => 
            token.document.hasStatusEffect(e.id)
        );
    
        if (activeEffects.length === 0) return '<div class="status-effects-container"></div>';
    
        return `
            <div class="status-effects-container">
                ${activeEffects.map(effect => `
                    <div class="status-effect-icon" 
                         data-effect-id="${effect.id}"
                         title="${effect.label}">
                        <img src="${effect.icon}" />
                    </div>
                `).join('')}
            </div>
        `;
    }

    // 상태 효과 토글
    static async toggleEffect(actorId, effectId) {
        const actor = game.actors.get(actorId);
        if (!actor) return;
    
        const token = canvas.tokens.placeables.find(t => t.actor?.id === actorId);
        if (!token) return;
    
        try {
            const effect = CONFIG.statusEffects.find(e => e.id === effectId);
            if (!effect) {
                console.error('Effect not found:', effectId);
                return;
            }
    
            await token.toggleEffect(effect);
    
            const actorCard = document.querySelector(`[data-actor-id="${actorId}"]`);
            if (actorCard) {
                const effectsContainer = actorCard.querySelector('.status-effects-container');
                if (effectsContainer) {
                    effectsContainer.outerHTML = this.createEffectIconsHTML(actor);
                    if (window.ActorStatusManager) {
                        window.ActorStatusManager._setupStatusEffectListeners();
                    }
                }
            }
    
        } catch (error) {
            console.error('Error toggling effect:', error);
            ui.notifications.error("상태 효과 토글 중 오류가 발생했습니다.");
        }
    }

    // 상태 효과 토글 처리
    static async _handleToggleEffect(actorId, effectId) {
        const actor = game.actors.get(actorId);
        const effect = actor?.effects.get(effectId);
        
        if (!effect) return;

        try {
            if (effect.disabled) {
                await effect.update({disabled: false});
            } else {
                await effect.update({disabled: true});
            }
        } catch (error) {
            console.error('Error toggling effect:', error);
            ui.notifications.error("상태 효과 토글 중 오류가 발생했습니다.");
        }
    }
}