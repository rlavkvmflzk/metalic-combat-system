export class TerrainManager {
    constructor(terrainDefinitions) {
        this.terrains = terrainDefinitions;
        this.gridSize = 100; // 기본 그리드 크기
        this.initialized = true;
    }

    /**
     * 매니저 초기화
     */
    initialize() {
        // 기본 그리드 사이즈로 초기화
        this.gridSize = canvas?.scene?.grid?.size || 100; // 기본값 사용
        this.initialized = true;
        console.log('TerrainManager initialized with grid size:', this.gridSize);
        
        // canvas가 준비되면 그리드 사이즈 업데이트
        Hooks.on('canvasReady', () => {
            if (canvas?.scene?.grid) {
                this.gridSize = canvas.scene.grid.size;
                console.log('TerrainManager updated grid size:', this.gridSize);
            }
        });
    }

    /**
     * 현재 그리드 크기 반환
     */
    getGridSize() {
        if (!this.initialized && canvas?.scene?.grid) {
            this.initialize();
        }
        return this.gridSize;
    }

    /**
     * 지정된 위치에서 지형 타일 찾기
     */
    getTerrainAtPosition(x, y) {
        if (!canvas?.tiles) return null;
                
        const sceneStartX = Math.floor((canvas.scene.dimensions.width - canvas.scene.width) / 2);
        const sceneStartY = Math.floor((canvas.scene.dimensions.height - canvas.scene.height) / 2);
        
        const position = {
            x: x - sceneStartX,
            y: y - sceneStartY
        };

        return canvas.tiles.placeables.find(tile => {
            if (!tile.document?.flags?.['metalic-combat-system']?.terrain) return false;
            
            // 타일의 전체 영역을 체크
            const tileX = tile.document.x;
            const tileY = tile.document.y;
            const tileWidth = Math.abs(tile.document.width);
            const tileHeight = Math.abs(tile.document.height);

            // 타일의 회전을 고려한 체크
            if (tile.document.rotation != 0) {
                const cX = tileX + (tileWidth / 2);
                const cY = tileY + (tileHeight / 2);
                
                // 점을 타일의 중심을 기준으로 회전
                function rotate(cx, cy, x, y, angle) {
                    const rad = Math.toRadians(-angle); // 역회전
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    const dx = x - cx;
                    const dy = y - cy;
                    return {
                        x: cx + (dx * cos - dy * sin),
                        y: cy + (dx * sin + dy * cos)
                    };
                }

                const rotatedPt = rotate(cX, cY, position.x, position.y, tile.document.rotation);
                position.x = rotatedPt.x;
                position.y = rotatedPt.y;
            }

            // 타일의 전체 영역 내에 있는지 체크
            return (position.x >= tileX && 
                    position.x <= tileX + tileWidth && 
                    position.y >= tileY && 
                    position.y <= tileY + tileHeight);
        });
    }

    /**
     * 새로운 지형 타일 생성
     */
    async createTerrain(sceneId, x, y, terrainType) {
        const terrain = this.terrains[terrainType];
        if (!terrain) {
            ui.notifications.error("유효하지 않은 지형 타입입니다.");
            return null;
        }
    
        const tileSize = game.settings.get('metalic-combat-system', 'terrainTileSize');
        const pixelSize = this.getGridSize() * tileSize;
    
        // 씬의 실제 시작 좌표 계산
        const sceneStartX = Math.floor((canvas.scene.dimensions.width - canvas.scene.width) / 2);
        const sceneStartY = Math.floor((canvas.scene.dimensions.height - canvas.scene.height) / 2);
    
        // 그리드에 맞춰 위치 조정 (상대 좌표 고려)
        const snapToGrid = (coord) => Math.floor(coord / this.getGridSize()) * this.getGridSize();
        const snappedX = snapToGrid(x - sceneStartX) + sceneStartX;
        const snappedY = snapToGrid(y - sceneStartY) + sceneStartY;
    
        const tileData = {
            x: snappedX,
            y: snappedY,
            width: pixelSize,
            height: pixelSize,
            z: 100,
            rotation: 0,
            hidden: false,
            // 텍스처 속성 명확하게 지정
            texture: {
                src: terrain.img,
                scaleX: 1,
                scaleY: 1,
                offsetX: 0,
                offsetY: 0,
                rotation: 0,
                tint: null
            },
            alpha: game.settings.get('metalic-combat-system', 'terrainTileAlpha'),
            flags: {
                'metalic-combat-system': {
                    terrain: {
                        type: terrainType,
                        ...terrain
                    }
                }
            }
        };
    
        try {
            // 이미지 존재 여부 확인
            const imgResponse = await fetch(terrain.img);
            if (!imgResponse.ok) {
                console.error(`지형 이미지를 찾을 수 없습니다: ${terrain.img}`);
                ui.notifications.warn(`지형 이미지를 찾을 수 없습니다: ${terrain.img}`);
                return null;
            }
    
            const scene = game.scenes.get(sceneId);
            if (!scene) {
                throw new Error("Scene not found");
            }
    
            const [created] = await scene.createEmbeddedDocuments("Tile", [tileData]);
            console.log('Created terrain tile:', created);
            return created;
        } catch (error) {
            console.error("지형 생성 중 오류 발생:", error);
            ui.notifications.error("지형을 생성하는 중 오류가 발생했습니다.");
            return null;
        }
    }

    /**
     * 기존 타일의 지형 업데이트
     */
    async updateTerrain(tile, terrainType) {
        const terrain = this.terrains[terrainType];
        if (!terrain) {
            ui.notifications.error("유효하지 않은 지형 타입입니다.");
            return false;
        }
    
        try {
            console.log('Updating terrain:', {
                tile: tile,
                terrain: terrain,
                terrainType: terrainType
            });
    
            const updateData = {
                texture: {
                    src: terrain.img
                },
                flags: {
                    'metalic-combat-system': {
                        terrain: {
                            type: terrainType,
                            ...terrain
                        }
                    }
                }
            };
    
            // tile.update 대신 tile.document.update 사용
            await tile.document.update(updateData);
            console.log('Terrain update successful');
            return true;
        } catch (error) {
            console.error("지형 업데이트 중 오류 발생:", error);
            ui.notifications.error("지형을 업데이트하는 중 오류가 발생했습니다.");
            return false;
        }
    }

    /**
     * 여러 타일을 한번에 생성
     */
    async createTerrainBatch(sceneId, positions, terrainType) {
        const terrain = this.terrains[terrainType];
        if (!terrain) {
            ui.notifications.error("유효하지 않은 지형 타입입니다.");
            return [];
        }
    
        const tileSize = game.settings.get('metalic-combat-system', 'terrainTileSize');
        const pixelSize = this.getGridSize() * tileSize;
        const alpha = game.settings.get('metalic-combat-system', 'terrainTileAlpha');
    
        const tileData = positions.map(({x, y}) => ({
            // 기본 타일 속성
            x: Math.floor(x / this.getGridSize()) * this.getGridSize(),
            y: Math.floor(y / this.getGridSize()) * this.getGridSize(),
            width: pixelSize,
            height: pixelSize,
            z: 100,
            rotation: 0,
            hidden: false,
            alpha: alpha,
            // texture 속성 추가
            texture: {
                src: terrain.img,
                scaleX: 1,
                scaleY: 1,
                offsetX: 0,
                offsetY: 0,
                rotation: 0,
                tint: null
            },
            flags: {
                'metalic-combat-system': {
                    terrain: {
                        type: terrainType,
                        ...terrain
                    }
                }
            }
        }));
    
        try {
            const scene = game.scenes.get(sceneId);
            if (!scene) {
                throw new Error("Scene not found");
            }
    
            // 이미지 존재 여부 확인
            const imgResponse = await fetch(terrain.img);
            if (!imgResponse.ok) {
                console.error(`지형 이미지를 찾을 수 없습니다: ${terrain.img}`);
                ui.notifications.warn(`지형 이미지를 찾을 수 없습니다: ${terrain.img}`);
                return [];
            }
    
            const created = await scene.createEmbeddedDocuments("Tile", tileData);
            console.log('Created terrain tiles:', created);
            return created;
        } catch (error) {
            console.error("다중 지형 생성 중 오류 발생:", error);
            ui.notifications.error("지형을 생성하는 중 오류가 발생했습니다.");
            return [];
        }
    }

    /**
     * 지정된 영역의 모든 지형 타일 가져오기
     */
    getTerrainInArea(x, y, width, height) {
        if (!canvas?.tiles) return [];
    
        const sceneStartX = Math.floor((canvas.scene.dimensions.width - canvas.scene.width) / 2);
        const sceneStartY = Math.floor((canvas.scene.dimensions.height - canvas.scene.height) / 2);
    
        return canvas.tiles.placeables.filter(tile => {
            const tileHasTerrain = tile.document.flags['metalic-combat-system']?.terrain;
            if (!tileHasTerrain) return false;
    
            const tileBox = new PIXI.Rectangle(
                tile.x - sceneStartX,
                tile.y - sceneStartY,
                tile.width,
                tile.height
            );
            const searchBox = new PIXI.Rectangle(
                x - sceneStartX,
                y - sceneStartY,
                width,
                height
            );
            
            return this._rectanglesIntersect(tileBox, searchBox);
        });
    }

    /**
     * 지형 정의 목록 반환
     */
    getTerrains() {
        return this.terrains;
    }

    /**
     * 특정 지형의 효과 계산
     */
    getTerrainEffects(tile) {
        if (!tile) return [];
        const terrainData = tile.document.flags['metalic-combat-system']?.terrain;
        return terrainData?.effects || [];
    }

    /**
     * 두 직사각형의 충돌 확인
     * @private
     */
    _rectanglesIntersect(rect1, rect2) {
        return !(rect1.x + rect1.width < rect2.x ||
                rect2.x + rect2.width < rect1.x ||
                rect1.y + rect1.height < rect2.y ||
                rect2.y + rect2.height < rect1.y);
    }

    /**
     * 디버그 정보 출력
     */
    debugInfo() {
        console.log({
            initialized: this.initialized,
            gridSize: this.gridSize,
            terrainTypes: Object.keys(this.terrains),
            activeTiles: canvas?.tiles?.placeables.filter(t => t.document.flags['metalic-combat-system']?.terrain).length
        });
    }
}