export class TemplateManager {
    static ID = 'metalic-combat-system';
    static socket = null;
    static activeTemplates = new Map(); // weaponId -> templateIds

    static initialize(socketlib) {
        if (!socketlib) {
            console.error('[TemplateManager] No socketlib provided');
            return false;
        }

        try {
            this.socket = socketlib;
            this._registerSocketHandlers();
            this._registerHooks();
            return true;
        } catch (error) {
            console.error('[TemplateManager] Initialization error:', error);
            return false;
        }
    }

    static _registerSocketHandlers() {
        this.socket.register('createTemplates', this._handleCreateTemplates.bind(this));
        this.socket.register('deleteTemplates', this._handleDeleteTemplates.bind(this));
    }

    static _registerHooks() {
        // 템플릿 생성 시 ruler 숨김
        Hooks.on('createMeasuredTemplate', (template) => {
            const t = template.object;
            if (t && t.ruler) {
                t.ruler.visible = false;
            }
        });

        // 씬 변경 시 템플릿 정리
        Hooks.on('updateScene', () => {
            this.clearAllTemplates();
        });
    }

    static async createWeaponTemplates(weaponData, token, options = {}) {
        if (!token || !weaponData) {
            console.error('[TemplateManager] Missing required data:', { token, weaponData });
            return null;
        }
    
        const baseGridSize = canvas.grid.size;
        const gameGridSize = baseGridSize * 2;
        const sceneWidth = canvas.scene.width;
        const sceneHeight = canvas.scene.height;
        
        const sceneStartX = Math.floor((canvas.scene.dimensions.width - sceneWidth) / 2);
        const sceneStartY = Math.floor((canvas.scene.dimensions.height - sceneHeight) / 2);
        
        const sceneInfo = { gameGridSize, sceneStartX, sceneStartY };
    
        console.log('Creating templates for weapon:', {
            weaponRange: weaponData.weaponrange,
            weaponTarget: weaponData.weapontarget,
            token: token
        });
    
        const rangeInfo = this.parseRange(weaponData.weaponrange);
        const targetInfo = this.parseTarget(weaponData.weapontarget);
    
        if (!rangeInfo && !targetInfo) {
            ui.notifications.warn("유효한 사정거리나 대상 정보가 없습니다.");
            return null;
        }
    
        let createdTemplates = [];
    
        // 먼저 사정거리 템플릿 생성 (항상 토큰 위치 기준)
        if (rangeInfo) {
            const rangeTemplateData = await this._generateTemplateData(
                rangeInfo,
                token,
                true,
                game.user.color,
                sceneInfo
            );
            
            if (rangeTemplateData.length > 0) {
                const rangeTemplates = await canvas.scene.createEmbeddedDocuments(
                    "MeasuredTemplate",
                    rangeTemplateData
                );
                createdTemplates = createdTemplates.concat(rangeTemplates);
            }
        }
    
        // 그 다음 대상 템플릿 생성 (클릭 위치 기준)
        if (targetInfo) {
            const targetTemplateData = await this._generateTemplateData(
                targetInfo,
                token,
                false,
                "#FF0000",
                sceneInfo
            );
            
            if (targetTemplateData.length > 0) {
                const targetTemplates = await canvas.scene.createEmbeddedDocuments(
                    "MeasuredTemplate",
                    targetTemplateData
                );
                createdTemplates = createdTemplates.concat(targetTemplates);
            }
        }
    
        if (createdTemplates.length > 0) {
            this.activeTemplates.set(weaponData._id, createdTemplates.map(t => t.id));
        }
    
        return createdTemplates;
    }

    static async deleteWeaponTemplates(weaponId) {
        const templateIds = this.activeTemplates.get(weaponId);
        if (!templateIds?.length) return;

        await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", templateIds);
        this.activeTemplates.delete(weaponId);
    }

    static async clearAllTemplates() {
        const allTemplateIds = Array.from(this.activeTemplates.values()).flat();
        if (allTemplateIds.length) {
            await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", allTemplateIds);
        }
        this.activeTemplates.clear();
    }

    static parseTarget(targetString) {
        if (!targetString) return null;
        
        targetString = targetString.replace(/\(선택\)|\$/g, '');
        
        // 범위와 RS 패턴
        if (targetString.match(/^(범위|RS)\d+$/)) {
            const value = Number(targetString.replace(/[^\d]/g, ''));
            return { type: 'simpleRange', value: value, needsSelection: true };
        }
        
        // 직선/돌파
        if (targetString.startsWith('직선') || targetString.startsWith('돌파')) {
            return { 
                type: 'line', 
                value: Number(targetString.replace(/[^\d]/g, '')),
                needsDirection: true
            };
        }
        
        // 폭x직선/돌파y
        if (targetString.startsWith('폭')) {
            const match = targetString.match(/폭(\d+)(직선|돌파)(\d+)/);
            if (match) {
                return { 
                    type: 'wideLine', 
                    width: Number(match[1]), 
                    range: Number(match[3]),
                    needsDirection: true
                };
            }
        }
        
        // 방사
        if (targetString.startsWith('방사')) {
            return { 
                type: 'radial', 
                value: Number(targetString.replace('방사', '')),
                needsDirection: true
            };
        }

        return null;
    }

    static parseRange(rangeString) {
        if (!rangeString) return null;

        rangeString = rangeString.replace(/\$/g, '');
        
        if (rangeString.includes('~')) {
            const [min, max] = rangeString.split('~').map(Number);
            return { 
                type: 'rangeMinMax', 
                min, 
                max,
                needsSelection: false
            };
        } 
        
        const value = Number(rangeString);
        if (!isNaN(value)) {
            return { 
                type: 'range', 
                min: 0, 
                max: value,
                needsSelection: false
            };
        }

        return null;
    }

    static async _generateTemplateData(info, token, isWeaponRange = false, color, sceneInfo) {
        const { gameGridSize, sceneStartX, sceneStartY } = sceneInfo;
        const templateData = [];
        let startX, startY;
        let selectedDirection = 'north';
     
        // 위치 선택 로직
        if (isWeaponRange) {
            // 사정거리는 항상 토큰 위치 기준
            const corner = this._get2x2Corner(token.x, token.y, sceneStartX, sceneStartY, gameGridSize);
            startX = corner.x;
            startY = corner.y;
        } else if (info.needsSelection || info.type === 'range' || info.type === 'rangeMinMax' || info.type === 'simpleRange') {
            // 범위나 RS, 범위1 등은 클릭으로 위치 선택
            const corner = await this._selectCenter(sceneStartX, sceneStartY, gameGridSize);
            startX = corner.x;
            startY = corner.y;
        } else {
            // 나머지는 토큰 위치 기준
            const corner = this._get2x2Corner(token.x, token.y, sceneStartX, sceneStartY, gameGridSize);
            startX = corner.x;
            startY = corner.y;
        }
     
        // 방향 선택 로직
        if (!isWeaponRange && (info.type === 'line' || info.type === 'wideLine' || info.type === 'radial')) {
            selectedDirection = await this._selectDirection();
        }
     
        switch (info.type) {
            case 'line':
                for (let i = 0; i <= info.value; i++) {
                    this._addTemplateRect(templateData, 0, -i, startX, startY, selectedDirection, color, gameGridSize);
                }
                break;
     
            case 'wideLine':
                const halfWidth = Math.floor(info.width / 2);
                for (let w = -halfWidth; w <= halfWidth; w++) {
                    for (let i = 0; i <= info.range; i++) {
                        this._addTemplateRect(templateData, w, -i, startX, startY, selectedDirection, color, gameGridSize);
                    }
                }
                break;
     
            case 'radial':
                this._addTemplateRect(templateData, 0, 0, startX, startY, selectedDirection, color, gameGridSize);
                if (info.value >= 1) {
                    this._addTemplateRect(templateData, 0, -1, startX, startY, selectedDirection, color, gameGridSize);
                }
                for (let i = 2; i <= info.value; i++) {
                    for (let dx = -i + 1; dx <= i - 1; dx++) {
                        this._addTemplateRect(templateData, dx, -i, startX, startY, selectedDirection, color, gameGridSize);
                    }
                }
                break;
     
            case 'simpleRange':
                if (info.value === 1) {
                    // 범위1은 단일 그리드
                    this._addTemplateRect(templateData, 0, 0, startX, startY, 'north', color, gameGridSize);
                } else {
                    // 범위2 이상은 실제 값보다 1 작게 처리
                    const adjustedValue = info.value - 1;
                    for (let dx = -adjustedValue; dx <= adjustedValue; dx++) {
                        for (let dy = -adjustedValue; dy <= adjustedValue; dy++) {
                            const distance = Math.abs(dx) + Math.abs(dy);
                            if (distance <= adjustedValue) {
                                this._addTemplateRect(templateData, dx, dy, startX, startY, 'north', color, gameGridSize);
                            }
                        }
                    }
                }
                break;
     
            case 'range':
            case 'rangeMinMax':
                const minRange = info.min !== undefined ? info.min : 0;
                const maxRange = info.max !== undefined ? info.max : info.value;
                for (let dx = -maxRange; dx <= maxRange; dx++) {
                    for (let dy = -maxRange; dy <= maxRange; dy++) {
                        const distance = Math.abs(dx) + Math.abs(dy);
                        if (distance >= minRange && distance <= maxRange) {
                            this._addTemplateRect(templateData, dx, dy, startX, startY, 'north', color, gameGridSize);
                        }
                    }
                }
                break;
        }
     
        return templateData;
     }

    static _get2x2Corner(x, y, sceneStartX, sceneStartY, gameGridSize) {
        // 씬의 시작점을 기준으로 상대 좌표 계산
        const relativeX = x - sceneStartX;
        const relativeY = y - sceneStartY;
        
        // 2x2 그리드로 나누어 위치 계산
        const gridX = Math.floor(relativeX / gameGridSize);
        const gridY = Math.floor(relativeY / gameGridSize);
        
        // 실제 좌표로 변환 (씬의 시작점 고려)
        const cornerX = (gridX * gameGridSize) + sceneStartX;
        const cornerY = (gridY * gameGridSize) + sceneStartY;
    
        console.log("Grid calculation:", {
            clickX: x,
            clickY: y,
            relativeX,
            relativeY,
            gridX,
            gridY,
            cornerX,
            cornerY,
            sceneStartX,
            sceneStartY
        });
        
        return { x: cornerX, y: cornerY };
    }

    static _addTemplateRect(templateData, dx, dy, startX, startY, direction, color, gameGridSize) {
        let [adjustedDx, adjustedDy] = this._adjustCoordinates(dx, dy, direction);
        
        const x = startX + (adjustedDx * gameGridSize);
        const y = startY + (adjustedDy * gameGridSize);
    
        const templateProperties = {
            t: "rect",
            user: game.user.id,
            x: x,
            y: y,
            width: gameGridSize,
            height: gameGridSize,
            direction: 45,
            distance: 1.4142135623730951,
            fillColor: color,
            fillAlpha: 0.5,
            borderColor: color,
            borderAlpha: 0.8,
            flags: { 
                customTemplate: true,
                displayRuler: false
            }
        };
    
        templateData.push(templateProperties);
    }

    static _adjustCoordinates(dx, dy, direction) {
        switch (direction) {
            case 'east': return [-dy, dx];
            case 'south': return [dx, -dy];
            case 'west': return [dy, dx];
            default: return [dx, dy]; // north
        }
    }

    static async _selectDirection() {
        const directions = [
            { value: 'east', label: '동' },
            { value: 'west', label: '서' },
            { value: 'south', label: '남' },
            { value: 'north', label: '북' }
        ];
        const directionContent = directions.map(dir => 
            `<option value="${dir.value}">${dir.label}</option>`
        ).join('');
        
        return new Promise((resolve) => {
            new Dialog({
                title: "방향 선택",
                content: `<form><div class="form-group"><label>방향:</label><select name="direction">${directionContent}</select></div></form>`,
                buttons: {
                    확인: {
                        label: "확인",
                        callback: (html) => resolve(html.find('[name="direction"]').val())
                    }
                }
            }).render(true);
        });
     }

     static async _selectCenter(sceneStartX, sceneStartY, gameGridSize) {
        return new Promise((resolve) => {
            const handler = (event) => {
                const { x, y } = event.data.getLocalPosition(canvas.app.stage);
                const corner = this._get2x2Corner(x, y, sceneStartX, sceneStartY, gameGridSize);
                
                // 선택된 위치 로깅
                console.log("Selected position:", x, y);
                console.log("Calculated corner:", corner);
                
                canvas.app.stage.off('click', handler);
                resolve(corner);
            };
            canvas.app.stage.once('click', handler);
            ui.notifications.info("템플릿을 배치할 2x2 영역을 클릭하세요.");
        });
    }     

    static async _handleCreateTemplates(data) {
        const { weaponData, tokenId } = data;
        const token = canvas.tokens.get(tokenId);
        return await this.createWeaponTemplates(weaponData, token);
    }

    static async _handleDeleteTemplates(weaponId) {
        return await this.deleteWeaponTemplates(weaponId);
    }
}