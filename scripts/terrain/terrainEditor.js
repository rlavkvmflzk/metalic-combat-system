// terrainEditor.js

export class TerrainEditor {
    constructor(manager) {
        this.manager = manager;
        this.active = false;
        this.isDrawing = false;
        this.startPoint = null;
        this.previewGraphics = null;
        this.selectedTerrain = 'normal';
        this.currentMode = null;
        this.highlightLayer = null;
        this.rectPreviewLayer = null;
        this._originalCursor = null;
        
        // 바인딩된 메서드들
        this.toggleEditMode = this.toggleEditMode.bind(this);
        this.toggleRectMode = this.toggleRectMode.bind(this);
        this.toggleFillMode = this.toggleFillMode.bind(this);
    }

    static addControls(controls) {
        const tileControls = controls.find(c => c.name === "tiles");
        if (!tileControls) return;

        // 이미 추가된 도구가 있는지 확인
        if (tileControls.tools.some(t => t.name === "terrain")) return;

        tileControls.tools.push(
            {
                name: "terrain",
                title: "지형 편집",
                icon: "fas fa-mountain",
                visible: game.user.isGM,
                toggle: true,
                onClick: () => {
                    if (game.terrain.editor) {
                        game.terrain.editor.toggleEditMode();
                    }
                },
                active: false
            },
            {
                name: "terrain-rect",
                title: "영역 지형 생성",
                icon: "fas fa-draw-polygon",
                visible: game.user.isGM,
                toggle: true,
                onClick: () => {
                    if (game.terrain.editor) {
                        game.terrain.editor.toggleRectMode();
                    }
                },
                active: false
            },
            {
                name: "terrain-fill",
                title: "지형 채우기",
                icon: "fas fa-fill-drip",
                visible: game.user.isGM,
                toggle: true,
                onClick: () => {
                    if (game.terrain.editor) {
                        game.terrain.editor.toggleFillMode();
                    }
                },
                active: false
            }
        );
    }

    _updateToolState(toolName, active) {
        const controls = ui.controls.controls;
        const tileControls = controls.find(c => c.name === "tiles");
        if (!tileControls) return;
    
        // 모든 terrain 도구 비활성화
        tileControls.tools
            .filter(t => t.name.startsWith("terrain"))
            .forEach(t => t.active = false);
    
        // 선택된 도구만 활성화
        const tool = tileControls.tools.find(t => t.name === toolName);
        if (tool) tool.active = active;
    
        ui.controls.render();
    }

    toggleEditMode() {
        if (this.currentMode === 'edit') {
            this._deactivate();
            this._updateToolState("terrain", false);
        } else {
            if (this.active) this._deactivate();
            this._activate('edit');
            this._updateToolState("terrain", true);
        }
    }

    toggleRectMode() {
        if (this.currentMode === 'rect') {
            this._deactivate();
            this._updateToolState("terrain-rect", false);
        } else {
            if (this.active) this._deactivate();
            this._activate('rect');
            this._updateToolState("terrain-rect", true);
        }
    }

    toggleFillMode() {
        if (this.currentMode === 'fill') {
            this._deactivate();
            this._updateToolState("terrain-fill", false);
        } else {
            if (this.active) this._deactivate();
            this._activate('fill');
            this._updateToolState("terrain-fill", true);
        }
    }

    _activate(mode) {
        if (ui.controls.activeControl !== 'tiles') {
            ui.notifications.warn("타일 레이어가 활성화되어 있을 때만 지형 편집이 가능합니다.");
            return;
        }
        this.active = true;
        this.currentMode = mode;

        this._originalCursor = $('canvas#board').css('cursor');
    
        if (this.highlightLayer) {
            this.highlightLayer.destroy();
        }
        this.highlightLayer = new PIXI.Graphics();
        canvas.primary.addChild(this.highlightLayer);
    
        if (this.rectPreviewLayer) {
            this.rectPreviewLayer.destroy();
        }
        this.rectPreviewLayer = new PIXI.Graphics();
        canvas.tiles.addChild(this.rectPreviewLayer);
    
        // 먼저 모든 이벤트 리스너 제거
        this._removeEventListeners();
    
        canvas.tiles.interactiveChildren = false;
    
        // 바인딩된 메서드 생성
        this._boundEditClick = (event) => {
            if (event.button === 0) {
                this._onEditClick(event);
            }
        };
        this._boundRectStart = (event) => {
            if (event.button === 0) {
                this._onRectStart(event);
            }
        };
        this._boundRectMove = this._onRectMove.bind(this);
        this._boundRectEnd = this._onRectEnd.bind(this);
        this._boundFillClick = (event) => {
            if (event.button === 0) {
                this._onFillClick(event);
            }
        };
        this._boundHover = this._handleHover.bind(this);
    
        switch(mode) {
            case 'edit':
                canvas.stage.on('mousedown', this._boundEditClick);
                canvas.stage.on('pointermove', this._boundHover);
                break;
            case 'rect':
                canvas.stage.on('mousedown', this._boundRectStart);
                canvas.stage.on('mousemove', this._boundRectMove);
                canvas.stage.on('mouseup', this._boundRectEnd);
                break;
            case 'fill':
                canvas.stage.on('mousedown', this._boundFillClick);
                canvas.stage.on('pointermove', this._boundHover);
                break;
        }
    
        const cursor = mode === 'fill' ? 'copy' : 'crosshair';
        $('canvas#board').css('cursor', cursor);
    }

    _handleHover(event) {
        if (ui.controls.activeControl !== 'tiles') return;
        if (!this.active || !this.highlightLayer || this.isDrawing) return;

        const pt = event.data.getLocalPosition(canvas.stage);
        const sceneStartX = Math.floor((canvas.scene.dimensions.width - canvas.scene.width) / 2);
        const sceneStartY = Math.floor((canvas.scene.dimensions.height - canvas.scene.height) / 2);
        
        const position = {
            x: pt.x + sceneStartX,
            y: pt.y + sceneStartY
        };

        const tile = this.manager.getTerrainAtPosition(position.x, position.y);
        
        this.highlightLayer.clear();
        if (tile) {
            this._highlightTerrain(tile);
        }
    }

    _highlightTerrain(tile) {
        if (!this.highlightLayer) return;

        this.highlightLayer.clear();

        const tileX = tile.document.x;
        const tileY = tile.document.y;
        const tileWidth = Math.abs(tile.document.width);
        const tileHeight = Math.abs(tile.document.height);
        const rotation = tile.document.rotation;
        const centerX = tileX + (tileWidth / 2);
        const centerY = tileY + (tileHeight / 2);

        this.highlightLayer.setTransform(centerX, centerY, 1, 1, Math.toRadians(rotation), 0, 0, 0, 0);
        
        this.highlightLayer
            .lineStyle(3, 0xFFFF00, 1) // 노란색으로 변경
            .beginFill(0xFFFF00, 0.2)
            .drawRect(
                -tileWidth/2,
                -tileHeight/2,
                tileWidth,
                tileHeight
            )
            .endFill();

        // 격자 패턴 추가
        this.highlightLayer.lineStyle(2, 0xFFFF00, 0.5);
        const gridSize = canvas.scene.grid.size;

        for (let x = -tileWidth/2; x <= tileWidth/2; x += gridSize) {
            this.highlightLayer
                .moveTo(x, -tileHeight/2)
                .lineTo(x, tileHeight/2);
        }

        for (let y = -tileHeight/2; y <= tileHeight/2; y += gridSize) {
            this.highlightLayer
                .moveTo(-tileWidth/2, y)
                .lineTo(tileWidth/2, y);
        }
    }

    _deactivate() {
        this.active = false;
        this.currentMode = null;
        this.isDrawing = false;
        this.startPoint = null;
    
        canvas.tiles.interactiveChildren = true;
    
        this._removeEventListeners();
    
        // 하이라이트 레이어 제거
        if (this.highlightLayer) {
            if (this.highlightLayer.parent) {
                this.highlightLayer.parent.removeChild(this.highlightLayer);
            }
            this.highlightLayer.destroy();
            this.highlightLayer = null;
        }
    
        // 사각형 미리보기 레이어 제거
        if (this.rectPreviewLayer) {
            if (this.rectPreviewLayer.parent) {
                this.rectPreviewLayer.parent.removeChild(this.rectPreviewLayer);
            }
            this.rectPreviewLayer.destroy();
            this.rectPreviewLayer = null;
        }

        if (this._originalCursor) {
            $('canvas#board').css('cursor', this._originalCursor);
            this._originalCursor = null;
        } else {
            $('canvas#board').css('cursor', ''); // 기본값으로 리셋
        }
    
        // 모든 도구의 상태를 비활성화
        this._updateToolState("terrain", false);
        this._updateToolState("terrain-rect", false);
        this._updateToolState("terrain-fill", false);
    }

    _removeEventListeners() {
        // 모든 이벤트 리스너 제거
        canvas.stage.off('mousedown');
        canvas.stage.off('mousemove');
        canvas.stage.off('mouseup');
        canvas.stage.off('pointermove');
        canvas.stage.off('pointerdown');
        canvas.stage.off('pointerup');
    }

    async _onEditClick(event) {
        if (ui.controls.activeControl !== 'tiles') return;
        const pos = event.data.getLocalPosition(canvas.stage);
        
        // 씬의 실제 시작 좌표를 고려하여 위치 계산
        const sceneStartX = Math.floor((canvas.scene.dimensions.width - canvas.scene.width) / 2);
        const sceneStartY = Math.floor((canvas.scene.dimensions.height - canvas.scene.height) / 2);
        
        // 실제 씬 좌표로 변환
        const x = pos.x + sceneStartX;
        const y = pos.y + sceneStartY;
    
        console.log('Clicked position:', { raw: pos, adjusted: { x, y } });
        
        const tile = this.manager.getTerrainAtPosition(x, y);
    
        if (tile) {
            console.log('Found terrain tile:', tile);
            this._showTerrainSelector(tile);
        } else {
            console.log('No terrain found at position, creating new');
            this._showNewTerrainDialog(x, y);
        }
    }

    _onRectStart(event) {
        if (ui.controls.activeControl !== 'tiles') return;
        if (event.button !== 0) return;  // 좌클릭이 아니면 무시
        if (this.isDrawing) return;
    
        const pos = event.data.getLocalPosition(canvas.stage);
        this.isDrawing = true;
        this.startPoint = {
            x: Math.floor(pos.x / this.manager.gridSize) * this.manager.gridSize,
            y: Math.floor(pos.y / this.manager.gridSize) * this.manager.gridSize
        };
    }
    

    _onRectMove(event) {
        if (ui.controls.activeControl !== 'tiles') return;
        if (!this.isDrawing) return;

        const pos = event.data.getLocalPosition(canvas.stage);
        const endPoint = {
            x: Math.floor(pos.x / this.manager.gridSize) * this.manager.gridSize,
            y: Math.floor(pos.y / this.manager.gridSize) * this.manager.gridSize
        };

        // 미리보기 업데이트
        this.rectPreviewLayer.clear()
            .lineStyle(2, 0x00ff00, 0.8)
            .drawRect(
                this.startPoint.x,
                this.startPoint.y,
                endPoint.x - this.startPoint.x + this.manager.gridSize,
                endPoint.y - this.startPoint.y + this.manager.gridSize
            );
    }

    async _onRectEnd(event) {
        if (ui.controls.activeControl !== 'tiles') return;
        if (!this.isDrawing) return;
    
        const pos = event.data.getLocalPosition(canvas.stage);
        const endPoint = {
            x: Math.floor(pos.x / this.manager.gridSize) * this.manager.gridSize,
            y: Math.floor(pos.y / this.manager.gridSize) * this.manager.gridSize
        };
    
        // 최소 크기 체크 (시작점과 끝점이 같지 않은 경우에만 진행)
        if (this.startPoint.x !== endPoint.x || this.startPoint.y !== endPoint.y) {
            // 영역 내 타일 위치 계산
            const positions = [];
            const tileSize = game.settings.get('metalic-combat-system', 'terrainTileSize');
            const step = this.manager.gridSize * tileSize;
    
            for (let x = this.startPoint.x; x <= endPoint.x; x += step) {
                for (let y = this.startPoint.y; y <= endPoint.y; y += step) {
                    positions.push({x, y});
                }
            }
    
            // 지형 선택 다이얼로그 표시
            this._showTerrainSelectorForBatch(positions);
        }
    
        // 미리보기 제거
        this.rectPreviewLayer.clear();
        this.isDrawing = false;
        this.startPoint = null;
    }

    _showTerrainSelector(tile) {
        const terrains = this.manager.getTerrains();
        
    return new Promise((resolve) => {
        new terrainEditorDialog({
            title: "지형 변경",
            content: this._getTerrainDialogContent(terrains),
            buttons: {
                apply: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "적용",
                    callback: (html) => {
                        const selected = html.find('.terrain-option.selected').data('terrain');
                        if (selected) {
                            this.manager.updateTerrain(tile, selected);
                        }
                    }
                },
                delete: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: "삭제",
                    callback: () => tile.delete()
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소"
                }
            },
            render: html => this._setupTerrainDialog(html)
        }).render(true);
    }
)}

    _showNewTerrainDialog(x, y) {
        const terrains = this.manager.getTerrains();
        
    return new Promise((resolve) => {
        new terrainEditorDialog({
            title: "새 지형 생성",
            content: this._getTerrainDialogContent(terrains),
            buttons: {
                create: {
                    icon: '<i class="fas fa-plus"></i>',
                    label: "생성",
                    callback: (html) => {
                        const selected = html.find('.terrain-option.selected').data('terrain');
                        if (selected) {
                            this.manager.createTerrain(canvas.scene.id, x, y, selected);
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소"
                }
            },
            render: html => this._setupTerrainDialog(html)
        }).render(true);
    }
)}
    

    _showTerrainSelectorForBatch(positions) {
        const terrains = this.manager.getTerrains();
        
        return new Promise((resolve) => {
            new terrainEditorDialog({
            title: "영역 지형 생성",
            content: this._getTerrainDialogContent(terrains),
            buttons: {
                create: {
                    icon: '<i class="fas fa-plus"></i>',
                    label: "생성",
                    callback: (html) => {
                        const selected = html.find('.terrain-option.selected').data('terrain');
                        if (selected) {
                            this.manager.createTerrainBatch(canvas.scene.id, positions, selected);
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "취소"
                }
            },
            render: html => this._setupTerrainDialog(html)
        }).render(true);
    }
)}

    _getTerrainDialogContent(terrains) {
        return `
        <style>
            .app.dialog {
                width: 600px !important;
                height: 650px !important;
            }
            .dialog .dialog-content {
                width: 100% !important;
                max-width: none !important;
            }
            .window-content {
                width: 100% !important;
                max-width: none !important;
            }                
            .terrain-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                padding: 10px;
            }
            .terrain-option {
                background: #f5f5f5;
                padding: 10px;
                border-radius: 5px;
                cursor: pointer;
                text-align: center;
                transition: all 0.2s ease;
                color:black;
            }
            .terrain-option:hover {
                background: #e0e0e0;
                transform: translateY(-2px);
            }
            .terrain-option img {
                width: 64px;
                height: 64px;
                margin-bottom: 5px;
                border-radius: 4px;
            }
            .terrain-option.selected {
                outline: 2px solid #4a4a4a;
                background: #d0d0d0;
            }
            .terrain-info {
                margin-top: 10px;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 4px;
                display: none;
                color:black;
            }
            .terrain-description {
                white-space: pre-line;
                line-height: 1.5;
                margin-top: 10px;
            }
            .effects {
                margin-top: 10px;
            }
            .effects ul {
                margin: 5px 0;
                padding-left: 20px;
            }
        </style>
        <div class="terrain-grid">
            ${Object.entries(terrains).map(([key, terrain]) => `
                <div class="terrain-option" data-terrain="${key}">
                    <div class="terrain-icon">${terrain.icon}</div>
                    <img src="${terrain.img}" alt="${terrain.name}">
                    <div>${terrain.name}</div>
                </div>
            `).join('')}
        </div>
        <div class="terrain-info"></div>
    `;
}

_setupTerrainDialog(html) {
    const terrains = this.manager.getTerrains();
    const infoDiv = html.find('.terrain-info');

    html.find('.terrain-option').click(ev => {
        const element = $(ev.currentTarget);
        html.find('.terrain-option').removeClass('selected');
        element.addClass('selected');

        const terrainKey = element.data('terrain');
        const terrain = terrains[terrainKey];
        
        if (terrain) {
            infoDiv.html(`
                <h3>${terrain.name}</h3>
                <div class="terrain-description">${terrain.description}</div>
                ${terrain.effects.length > 0 ? `
                    <div class="effects">
                        <h4>효과:</h4>
                        <ul>
                            ${terrain.effects.map(effect => `<li>${effect}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            `).slideDown();
        }
    });
}

async _onFillClick(event) {
    if (ui.controls.activeControl !== 'tiles') return;
    const pos = event.data.getLocalPosition(canvas.stage);
    
    const sceneStartX = Math.floor((canvas.scene.dimensions.width - canvas.scene.width) / 2);
    const sceneStartY = Math.floor((canvas.scene.dimensions.height - canvas.scene.height) / 2);
    
    const x = pos.x + sceneStartX;
    const y = pos.y + sceneStartY;

    const sourceTile = this.manager.getTerrainAtPosition(x, y);
    
    if (!sourceTile) {
        ui.notifications.warn("채울 지형을 선택해주세요.");
        return;
    }

    const sourceType = sourceTile.document.flags['metalic-combat-system']?.terrain?.type;
    if (!sourceType) {
        ui.notifications.warn("유효하지 않은 지형입니다.");
        return;
    }

    // 연결된 타일들 찾기
    const connectedTiles = this._findConnectedTiles(sourceTile);

    if (connectedTiles.length === 0) {
        ui.notifications.warn("변경할 타일이 없습니다.");
        return;
    }

    new Dialog({
        title: "지형 채우기",
        content: `선택한 유형(${sourceType})의 연결된 타일 ${connectedTiles.length}개를 변경합니다.`,
        buttons: {
            fill: {
                icon: '<i class="fas fa-fill-drip"></i>',
                label: "채우기",
                callback: () => this._showTerrainSelectorForFill(connectedTiles)
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "취소"
            }
        }
    }).render(true);
}

_showTerrainSelectorForFill(tiles) {
    const terrains = this.manager.getTerrains();
    
    new Dialog({
        title: "지형 채우기",
        content: this._getTerrainDialogContent(terrains),
        buttons: {
            apply: {
                icon: '<i class="fas fa-check"></i>',
                label: "적용",
                callback: async (html) => {
                    const selected = html.find('.terrain-option.selected').data('terrain');
                    if (selected) {
                        let updated = 0;
                        for (const tile of tiles) {
                            if (await this.manager.updateTerrain(tile, selected)) {
                                updated++;
                            }
                        }
                        ui.notifications.info(`${updated}개의 타일이 업데이트되었습니다.`);
                    }
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "취소"
            }
        },
        render: html => this._setupTerrainDialog(html)
    }).render(true);
}

_findConnectedTiles(startTile) {
    const sourceType = startTile.document.flags['metalic-combat-system']?.terrain?.type;
    const visited = new Set();
    const connected = new Set();
    const tileSize = game.settings.get('metalic-combat-system', 'terrainTileSize') * this.manager.gridSize;

    const queue = [startTile];
    visited.add(startTile.id);
    connected.add(startTile);

    while (queue.length > 0) {
        const currentTile = queue.shift();
        const neighbors = this._getAdjacentTiles(currentTile, tileSize);

        for (const neighbor of neighbors) {
            if (visited.has(neighbor.id)) continue;
            
            visited.add(neighbor.id);
            
            const neighborType = neighbor.document.flags['metalic-combat-system']?.terrain?.type;
            if (neighborType === sourceType) {
                connected.add(neighbor);
                queue.push(neighbor);
            }
        }
    }

    return Array.from(connected);
}

_getAdjacentTiles(tile, tileSize) {
    const centerX = tile.document.x + tileSize / 2;
    const centerY = tile.document.y + tileSize / 2;
    
    // 상하좌우 인접한 타일 위치
    const adjacentPositions = [
        { x: centerX - tileSize, y: centerY }, // 왼쪽
        { x: centerX + tileSize, y: centerY }, // 오른쪽
        { x: centerX, y: centerY - tileSize }, // 위
        { x: centerX, y: centerY + tileSize }  // 아래
    ];

    return canvas.tiles.placeables.filter(other => {
        if (!other.document.flags['metalic-combat-system']?.terrain) return false;
        
        const otherCenterX = other.document.x + tileSize / 2;
        const otherCenterY = other.document.y + tileSize / 2;

        return adjacentPositions.some(pos => 
            Math.abs(pos.x - otherCenterX) < 1 && 
            Math.abs(pos.y - otherCenterY) < 1
        );
    });
}
}

class terrainEditorDialog extends Dialog {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["terrainEditor-dialog"],
            width: 800,
            resizable: true
        });
    }
}