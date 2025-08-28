import { TerrainManager } from './terrainManager.js';
import { TerrainEditor } from './terrainEditor.js';
import { TerrainViewer } from './terrainViewer.js';
import { TerrainManagerUI } from './terrainManagerUI.js';

class TerrainSystem {
    static ID = 'metalic-combat-system';

    static TOOLS = {
        editor: ['terrain', 'terrain-rect', 'terrain-fill'],
        viewer: ['terrain-info']
    };

    static initialize() {
        console.log('Terrain System | Init called');
        this.registerSettings();
        
        // API 구성
        game.terrain = {
            terrains: this.getTerrainDefinitions(),
            manager: new TerrainManager(this.getTerrainDefinitions()),
            editor: null,
            viewer: null,
            ui: new TerrainManagerUI()
        };
    
        // editor와 viewer 초기화
        game.terrain.editor = new TerrainEditor(game.terrain.manager);
        game.terrain.viewer = new TerrainViewer(game.terrain.manager);
    
        // 버튼 추가를 Hook으로 등록
        Hooks.on('getSceneControlButtons', (controls) => {
            if (game.user.isGM && game.terrain.editor) {
                TerrainEditor.addControls(controls);
                TerrainManagerUI.addControls(controls); // 여기에 UI 컨트롤 추가
            }
            
            const tokenControls = controls.find(c => c.name === "token");
            if (tokenControls && game.terrain.viewer) {
                TerrainViewer.addControls(controls);
            }
        });
        

        // 캔버스 준비되면 그리드 크기 업데이트
        Hooks.on('canvasReady', () => {
            if (game.terrain.manager) {
                game.terrain.manager.initialize();
            }
        });

        const oldClickTool = SceneControls.prototype._onClickTool;
        SceneControls.prototype._onClickTool = function(event) {
            const li = event.currentTarget;
            const control = this.control;
            const toolName = li.dataset.tool;

            // 이전 활성화된 컨트롤/도구 확인
            const wasInTiles = control?.name === 'tiles';
            const wasInToken = control?.name === 'token';

            // 기본 동작 실행
            const result = oldClickTool.call(this, event);

            // 현재 컨트롤/도구 상태 확인
            const isEditorTool = TerrainSystem.TOOLS.editor.includes(toolName);
            const isViewerTool = TerrainSystem.TOOLS.viewer.includes(toolName);

            // tiles 컨트롤에서 editor 도구가 아닌 것을 선택했거나
            // 다른 컨트롤로 변경된 경우 editor 비활성화
            if ((wasInTiles && !isEditorTool) || !wasInTiles) {
                if (game.terrain.editor?.active) {
                    game.terrain.editor._deactivate();
                }
            }

            // token 컨트롤에서 viewer 도구가 아닌 것을 선택했거나
            // 다른 컨트롤로 변경된 경우 viewer 비활성화
            if ((wasInToken && !isViewerTool) || !wasInToken) {
                if (game.terrain.viewer?.active) {
                    game.terrain.viewer._deactivate();
                }
            }

            ui.controls.render();
            return result;
        }
    }

    static registerSettings() {
        // 타일 크기 설정
        game.settings.register(this.ID, 'terrainTileSize', {
            name: '지형 타일 크기',
            hint: '지형 타일의 크기를 그리드 단위로 설정합니다',
            scope: 'world',
            config: true,
            type: Number,
            default: 2,
            range: {
                min: 1,
                max: 4,
                step: 1
            }
        });

        // 타일 투명도 설정
        game.settings.register(this.ID, 'terrainTileAlpha', {
            name: '지형 타일 투명도',
            hint: '지형 타일의 투명도를 설정합니다',
            scope: 'world',
            config: true,
            type: Number,
            default: 1.0,
            range: {
                min: 0.1,
                max: 1.0,
                step: 0.1
            }
        });

        // 지형 정의 저장
        game.settings.register(this.ID, 'terrainDefinitions', {
            name: '지형 정의',
            scope: 'world',
            config: false,
            type: Object,
            default: TerrainManagerUI.defaultTerrains,
            onChange: () => {
                // 지형 정의가 변경되면 매니저 업데이트
                if (game.terrain?.manager) {
                    game.terrain.manager.initialize();
                }
            }
        });
    }

    static _initializeTerrainDefinitions() {
        // 기본 지형 정의가 없으면 초기화
        const currentTerrains = game.settings.get(this.ID, 'terrainDefinitions');
        if (Object.keys(currentTerrains).length === 0) {
            game.settings.set(this.ID, 'terrainDefinitions', TerrainManagerUI.defaultTerrains);
        }
    }

    static initializeComponents() {
        try {
            console.log('Terrain System | Initializing components...');
            
            // 컴포넌트 초기화
            Hooks.callAll('beforeTerrainSystemInit', this);

            const manager = new TerrainManager(this.getTerrainDefinitions());
            manager.initialize();
            game.terrain.manager = manager;

            if (game.user.isGM) {
                game.terrain.editor = new TerrainEditor(manager);
            }

            game.terrain.viewer = new TerrainViewer(manager);

            Hooks.callAll('afterTerrainSystemInit', this);
            
            console.log('Terrain System | Components initialized successfully');
        } catch (error) {
            console.error('Terrain System | Initialization error:', error);
        }
    }

    static getTerrainDefinitions() {
        return game.settings.get(this.ID, 'terrainDefinitions');
    }

    static addControls(controls) {
        const tileControls = controls.find(c => c.name === "tiles");
        if (!tileControls) return;
    
        // 기존 편집 도구들
        tileControls.tools.push({
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
        });
    
        // 지형 관리 버튼 추가
        tileControls.tools.push({
            name: "terrain-management",
            title: "지형 관리",
            icon: "fas fa-layer-group",
            visible: game.user.isGM,
            button: true,
            onClick: () => TerrainManagerUI.showManager()
        });
    }
}

// 초기화 훅
Hooks.once('init', () => {
    try {
        console.log('Terrain System | Init hook fired');
        TerrainSystem.initialize();
    } catch (error) {
        console.error('Terrain System | Init hook error:', error);
    }
});

export default TerrainSystem;