export class TerrainViewer {
    constructor(manager) {
        this.manager = manager;
        this.active = false;
        this.highlightLayer = null;
    }

    static addControls(controls) {
        const tokenControls = controls.find(c => c.name === "token");
        if (!tokenControls) return;

        tokenControls.tools.push({
            name: "terrain-info",
            title: "지형 정보 보기",
            icon: "fas fa-info-circle",
            visible: true,
            toggle: true,
            onClick: () => game.terrain.viewer?.toggleViewMode(),
            active: false
        });
    }

    toggleViewMode() {
        if (this.active) {
            this._deactivate();
        } else {
            this._activate();
        }
    }

    _activate() {
        console.log("TerrainViewer: Activating viewer");
        this.active = true;

        if (this.highlightLayer) {
            this.highlightLayer.destroy();
        }

        // 하이라이트 레이어를 background나 primary에 추가해서 모든 레이어에서 보이도록
        this.highlightLayer = new PIXI.Graphics();
        canvas.primary.addChild(this.highlightLayer);  // 또는 canvas.background

        // TokenLayer의 클릭 이벤트 후킹
        this._hookTokenLayerEvents();

        $('canvas#board').css('cursor', 'help');
        ui.notifications.info("지형 정보 보기가 활성화되었습니다.");
    }

    _deactivate() {
        this.active = false;

        // 이벤트 후킹 제거
        this._unhookTokenLayerEvents();

        if (this.highlightLayer) {
            if (this.highlightLayer.parent) {
                this.highlightLayer.parent.removeChild(this.highlightLayer);
            }
            this.highlightLayer.destroy();
            this.highlightLayer = null;
        }

        $('canvas#board').css('cursor', '');
        ui.notifications.info("지형 정보 보기가 비활성화되었습니다.");
    }

    _hookTokenLayerEvents() {
        const tokenLayer = canvas.tokens;
        
        // 기존 메서드 저장
        this._oldLeftClick = tokenLayer._onClickLeft;
        this._oldRightClick = tokenLayer._onClickRight;
        
        // 좌클릭은 원래 동작만 실행
        tokenLayer._onClickRight = (event) => {
            this._oldRightClick.call(tokenLayer, event);
        };
        
        // 우클릭만 지형 정보 보기 기능 실행
        tokenLayer._onClickLeft = (event) => {
            if (this.active) {
                this._handleTerrainClick(event, 'rightclick');
            }
            this._oldLeftClick.call(tokenLayer, event);
        };
    
        // hover 이벤트는 유지
        tokenLayer.on('mousemove', this._handleTerrainHover.bind(this));
    }

    _unhookTokenLayerEvents() {
        const tokenLayer = canvas.tokens;
        
        // 원래 메서드로 복구
        if (this._oldLeftClick) {
            tokenLayer._onClickLeft = this._oldLeftClick;
            this._oldLeftClick = null;
        }
        if (this._oldRightClick) {
            tokenLayer._onClickRight = this._oldRightClick;
            this._oldRightClick = null;
        }

        tokenLayer.off('mousemove', this._handleTerrainHover.bind(this));
    }

    _handleTerrainClick(event, clicktype) {
        if (!this.active) return;
    
        const pt = event.data.getLocalPosition(canvas.stage);
        // 씬의 실제 시작 좌표를 고려한 위치 계산
        const sceneStartX = Math.floor((canvas.scene.dimensions.width - canvas.scene.width) / 2);
        const sceneStartY = Math.floor((canvas.scene.dimensions.height - canvas.scene.height) / 2);
        
        const position = {
            x: pt.x + sceneStartX,
            y: pt.y + sceneStartY
        };
    
        const tile = this.manager.getTerrainAtPosition(position.x, position.y);
        if (tile) {
            this._showTerrainInfo(tile);
        }
    }
    
    _handleTerrainHover(event) {
        if (!this.active || !this.highlightLayer) return;
    
        const pt = event.data.getLocalPosition(canvas.stage);
        // 씬의 실제 시작 좌표를 고려한 위치 계산
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
        
        // 회전을 고려한 하이라이트 그리기
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
            .lineStyle(3, 0x00ff00, 1)
            .beginFill(0x00ff00, 0.2)
            .drawRect(
                -tileWidth/2,
                -tileHeight/2,
                tileWidth,
                tileHeight
            )
            .endFill();

        // 격자 패턴 추가
        this.highlightLayer.lineStyle(2, 0x00ff00, 0.5);
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

    _showTerrainInfo(tile) {
        const terrainData = tile.document.flags['metalic-combat-system']?.terrain;
        if (!terrainData) {
            console.log("TerrainViewer: No terrain data found for tile");
            return;
        }

        console.log("TerrainViewer: Showing terrain info dialog", terrainData);

        const tokens = canvas.tokens.placeables.filter(token => {
            const tokenCenter = {
                x: token.x + token.width/2,
                y: token.y + token.height/2
            };
            return this._isPointInTile(tokenCenter, tile);
        });

        new Dialog({
            title: `${terrainData.name} 지형`,
            content: this._getTerrainInfoContent(terrainData, tokens),
            buttons: {
                close: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "닫기"
                }
            },
            render: html => this._setupInfoDialog(html, terrainData)
        }).render(true);
    }

    _isPointInTile(point, tile) {
        return point.x >= tile.x &&
               point.x <= tile.x + tile.width &&
               point.y >= tile.y &&
               point.y <= tile.y + tile.height;
    }

// terrainViewer.js의 _getTerrainInfoContent 메서드 수정

_getTerrainInfoContent(terrain, affectedTokens) {
    return `
        <style>
            .terrain-info {
                background: #f5f5f5;
                padding: 15px;
                border-radius: 8px;
                color:black;
            }
            .terrain-image {
                text-align: center;
                margin-bottom: 15px;
            }
            .terrain-image img {
                width: 100px;
                height: 100px;
                border-radius: 8px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .effects-list {
                margin-top: 10px;
                list-style: none;
                padding: 0;
            }
            .effects-list li {
                padding: 8px;
                background: white;
                border-radius: 4px;
                margin-bottom: 5px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .effects-list li i {
                color: #4a90e2;
            }
            .terrain-description {
                margin-top: 15px;
                padding: 10px;
                background: white;
                border-radius: 5px;
                white-space: pre-line;
                line-height: 1.5;
            }
            .affected-tokens {
                margin-top: 15px;
                padding: 10px;
                background: white;
                border-radius: 5px;
            }
            .token-list {
                list-style: none;
                padding: 0;
                margin-top: 5px;
            }
            .token-list li {
                padding: 4px 8px;
                background: #f8f9fa;
                border-radius: 4px;
                margin-bottom: 4px;
            }
        </style>
        <div class="terrain-info">
            <div class="terrain-image">
                <img src="${terrain.img}" alt="${terrain.name}">
            </div>
            
            <h2 style="text-align: center; margin: 10px 0;">
                ${terrain.icon} ${terrain.name}
            </h2>

            ${terrain.effects?.length > 0 ? `
                <div class="effects-list">
                    ${terrain.effects.map(effect => `
                        <li>
                            <i class="fas fa-check"></i>
                            ${effect}
                        </li>
                    `).join('')}
                </div>
            ` : ''}

            ${terrain.description ? `
                <div class="terrain-description">
                    <i class="fas fa-book-open"></i>
                    ${terrain.description}
                </div>
            ` : ''}

            ${affectedTokens.length > 0 ? `
                <div class="affected-tokens">
                    <h3 style="margin: 0;">
                        <i class="fas fa-users"></i>
                        영향 받는 캐릭터
                    </h3>
                    <ul class="token-list">
                        ${affectedTokens.map(token => `
                            <li>${token.name}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        </div>
    `;
}

    _setupInfoDialog(html, terrainData) {
        // 추가적인 다이얼로그 설정이 필요한 경우 여기에 구현
    }

    _isPointInTile(point, tile) {
        return point.x >= tile.x &&
               point.x <= tile.x + tile.width &&
               point.y >= tile.y &&
               point.y <= tile.y + tile.height;
    }
 }