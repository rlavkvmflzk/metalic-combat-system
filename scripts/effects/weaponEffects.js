// weaponEffects.js
export class WeaponEffects {
    static async preloadAssets() {
        await Sequencer.Preloader.preloadForClients([
            "jb2a.bullet.Snipe.blue",
            "jb2a.bullet.Snipe.orange",
            "jb2a.impact.orange.0",
            "jb2a.impact.blue.0",
            "jb2a.bullet.01.blue",
            "jb2a.energy_beam.normal.blue",
            "jb2a.static_electricity.01.blue",
            "jb2a.explosion.01.orange",
            "jb2a.melee_generic.slash.01.orange",
            "jb2a.explosion.01",
            "jb2a.static_electricity.03.blue",
            "jb2a.bolt.physical.orange",
            "jb2a.melee_attack.03.trail.greatsword",
            "jb2a.impact.blue",
            "jb2a.lightning_ball.blue",
            "jb2a.explosion.02.blue",
            "jb2a.lightning_ball.blue",
            "jb2a.explosion.02.blue",
            "jb2a.melee_attack.01.magic_sword.yellow",
            "jb2a.impact.blue.3",
            "jb2a.gust_of_wind.veryfast",
            "jb2a.impact.yellow",
            "jb2a.dancing_light.purplegreen",
            "jb2a.fumes.steam.white",
            "jb2a.divine_smite.caster.blueyellow",
            "jb2a.impact.blue",
            "jb2a.divine_smite.target.blueyellow",
            "jb2a.extras.tmfx.outpulse.circle.01.normal",
            "jb2a.impact.001",
            "jb2a.burning_hands.01.orange",
            "jb2a.flames.02.orange",
            "jb2a.explosion.04.blue",
            "jb2a.impact.yellow",
            "jb2a.lasershot.green",
            "jb2a.toll_the_dead.green.shockwave",
            "jb2a.smoke.puff.side.02.white",
            "jb2a.melee_attack.03.maul.01",
            "jb2a.impact.ground_crack.orange.01",
            "jb2a.smoke.puff.centered.grey",
            "jb2a.bullet.01.orange",
            "jb2a.explosion.02.orange"
        ]);
    }

    static getEffectVolume(baseVolume = 0.5) {
        return game.settings.get("metalic-combat-system", "effectVolume") ?? baseVolume;
    }

    static async playWeaponEffect(sourceToken, targetTokens, weaponFx, success = true) {
        if (!sourceToken || !targetTokens.length) return;

        let sequence = new Sequence();
        
        switch (weaponFx?.toLowerCase()?.replace('$', '') ?? 'default') {
            case "대물소총":
            case "amr":
            case "anti-material rifle":
                await this._playAMREffect(sequence, sourceToken, targetTokens, success);
                break;    
            case "섬멸자":
            case "annihilator":
                await this._playAnnihilatorEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "아포칼립스 레일":
            case "Apocalypse Rail":
                await this._playConversionEffect(sequence, sourceToken, targetTokens, success);
                break;    
            case "전궁":
            case "arcbow":
                await this._playArcBowEffect(sequence, sourceToken, targetTokens, success);
                break;    
                case "돌격소총":
            case "assault rifle":
            case "ar":
                await this._playAssaultRifleEffect(sequence, sourceToken, targetTokens, success);
                break;
                case "동화아귀":
            case "assimilationmaw":
                await this._playAssimilationMawEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "자동포드":
            case "autopod":
                await this._playAutoPodEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "전투소총":
            case "battlerifle":
                await this._playBattleRifleEffect(sequence, sourceToken, targetTokens, success);
                break;    
            case "폭발곡괭이":
            case "blastpick":
                await this._playBlastPickEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "볼트투척기":
            case "bolt thrower":
                await this._playBoltThrowerEffect(sequence, sourceToken, targetTokens, success);
                break;    
            case "피의 대검":
            case "brood siblings molt":
                await this._playBroodSiblingsEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "폭렬발사기":
            case "cannon airburst":
                await this._playCannonAirburstEffect(sequence, sourceToken, targetTokens, success);
                break;                
                case "대공포":
            case "burst launcher":
                await this._playBurstLauncherEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "충전검":
            case "charged blade":
                await this._playChargedBladeEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "전투드릴":
            case "combat drill":
                await this._playCombatDrillEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "사이클론 펄스 라이플":
            case "cyclone pulse rifle":
            case "cpr":
                await this._playCyclonePulseRifleEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "dd288":
            case "dd 288":
                await this._playDD288Effect(sequence, sourceToken, targetTokens, success);
                break;
            case "전위기":
            case "displacer":
                await this._playDisplacerEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "교란채찍":
            case "disruptor whip":
                await this._playDisruptorWhipEffect(sequence, sourceToken, targetTokens, success);
                break;
                case "화염방사기":
            case "flamethrower":
                await this._playFlamethrowerEffect(sequence, sourceToken, targetTokens, success);
                break;
                case "연료봉총":
            case "fuel rod gun":
                await this._playFuelRodEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "망치":
            case "hammer":
                await this._playHammerEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "중기관총":
            case "hmg":
            case "heavy machine gun":
                await this._playHMGEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "충격창":
            case "임팩트 랜스":
            case "impact lance":
                await this._playImpactLanceEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "크라울 라이플":
            case "kraul rifle":
                await this._playKraulRifleEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "레이저":
            case "laser":
            case "lasers":
                await this._playLaserEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "래치드론":
            case "latch drone":
                await this._playLatchDroneEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "기본근접":
            case "default melee":
                await this._playDefaultMeleeEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "해킹":
            case "default tech":
                await this._playDefaultTechEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "레비아탄":
            case "leviathan":
                await this._playLeviathanEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "미사일": 
            case "missile":
                await this._playMissileEffect(sequence, sourceToken, targetTokens, success);
                break;
                case "missilepinaka":
            case "피나카":
                await this._playMissilePinakaEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "missiles":
            case "다연장미사일":
                await this._playMissilesEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "mortar":
            case "박격포":
                await this._playMortarEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "nanobotwhip":
            case "나노봇채찍":
                await this._playNanobotWhipEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "needlebeam":
            case "니들빔":
                await this._playNeedleBeamEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "nexus":
            case "넥서스":
                await this._playNexusEffect(sequence, sourceToken, targetTokens, success);
                break;    
            case "pistol":
            case "권총":
                await this._playPistolEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "plasmamaul":
            case "플라즈마망치":
                await this._playPlasmaMaulEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "plasmarifle":
            case "플라즈마라이플":
                await this._playPlasmaRifleEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "plasmatalons":
            case "플라즈마발톱":
                await this._playPlasmaTalonsEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "plasmathrower":
            case "플라즈마방사기":
                await this._playPlasmaThrowerEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "plasmatorch":
            case "플라즈마토치":
                await this._playPlasmaTorchEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "ppc":
            case "입자포":
                await this._playPPCEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "railgun":
            case "레일건":
                await this._playRailgunEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "retortloop":
            case "리토트루프":
                await this._playRetortLoopEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "shockbaton":
            case "충격봉":
                await this._playShockBatonEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "shotgun":
            case "산탄총":
                await this._playShotgunEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "slagcannon":
            case "슬래그캐논":
                await this._playSlagCannonEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "tachyonlance":
            case "타키온랜스":
                await this._playTachyonLanceEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "tempestblade":
            case "템페스트블레이드":
                await this._playTempestBladeEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "thermalrifle":
            case "열능소총":
                await this._playThermalRifleEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "torch":
            case "도끼":
                await this._playTorchEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "veilrifle":
            case "베일라이플":
                await this._playVeilRifleEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "warpike":
            case "워파이크":
                await this._playWarPikeEffect(sequence, sourceToken, targetTokens, success);
                break;
            case "warprifle":
            case "워프라이플":
                await this._playWarpRifleEffect(sequence, sourceToken, targetTokens, success);
                break;
            default:
                await this._playDefaultEffect(sequence, sourceToken, targetTokens, success);
        }

        await sequence.play();
    }

    static async _playAMREffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            // 발사 준비음
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/WeaponClick.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .waitUntilFinished(200)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/AMR_Fire.ogg")
                    .volume(this.getEffectVolume(0.5));
    
            // 발사 효과
            sequence
                .effect()
                    .file("jb2a.bullet.Snipe.blue")
                    .filter("ColorMatrix", { hue: 200 })
                    .atLocation(sourceToken)
                    .stretchTo(target)
                    .missed(!success);
    
            if (success) {
                // 명중음
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/AMR_Impact.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .delay(75);
    
                // 충격 효과
                sequence
                    .effect()
                        .file("jb2a.impact.orange.0")
                        .atLocation(target)
                        .rotateTowards(sourceToken)
                        .rotate(230)
                        .center()
                        .delay(75)
                        .waitUntilFinished();
            }
        }
    }

        // 섬멸자/분해자 효과 추가
        static async _playAnnihilatorEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                // 충전 사운드
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Annihilator_Charge.ogg")
                        .volume(this.getEffectVolume(0.5));
        
                // 충전 효과
                sequence
                    .effect()
                        .file("jb2a.static_electricity.01.blue")
                        .atLocation(sourceToken)
                        .scale(1.2)
                        .tint("#c91af9")
                        .fadeIn(500)
                        .duration(1000)
                        .fadeOut(300)
                        .opacity(0.7);
        
                // 주 공격 빔
                sequence
                    .effect()
                        .file("jb2a.eldritch_blast.purple")
                        .startTime(900)
                        .scale(0.86)
                        .atLocation(sourceToken)
                        .stretchTo(target)
                        .missed(!success)
                        .name("impact")
                        .waitUntilFinished(-3100);
        
                // 발사 사운드와 충격 효과
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/Annihilator.ogg")
                            .volume(this.getEffectVolume(0.5));
        
                    sequence
                        .effect()
                            .file("jb2a.impact.blue.3")
                            .scale(1.0)
                            .tint("#c91af9")
                            .atLocation(target)
                            .waitUntilFinished(-400);
                } else {
                    // 빗나갔을 때도 발사음과 충격 효과 재생
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/Annihilator.ogg")
                            .volume(this.getEffectVolume(0.5));
        
                    sequence
                        .effect()
                            .file("jb2a.impact.blue.3")
                            .scale(1.0)
                            .tint("#c91af9")
                            .atLocation("impact")
                            .waitUntilFinished(-400);
                }
            }
        }

        static async _playConversionEffect(sequence, sourceToken, targetTokens, success) {
            // 첫 번째 대상 위치 사용
            const target = targetTokens[0];
            if (!target) return;
        
            // 장전 사운드
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/APR2_Load.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .waitUntilFinished();
        
            // 발사 사운드
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/APR2_Fire.ogg")
                    .volume(this.getEffectVolume(0.5));
        
            // 발사 효과
            sequence
                .effect()
                    .file("jb2a.bullet.01.orange")
                    .atLocation(sourceToken)
                    .stretchTo(target)
                    .scale(2.0)
                    .waitUntilFinished(-300);
        
            // 폭발 효과와 사운드
            sequence
                .effect()
                    .file("jb2a.fireball.explosion.orange")
                    .atLocation(target)
                    .zIndex(1)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/APR2_Impact.ogg")
                    .volume(this.getEffectVolume(0.5));
        }

            // 전궁/ArcBow 효과
            static async _playArcBowEffect(sequence, sourceToken, targetTokens, success) {
                // 가장 먼 대상 찾기
                const farthest = this._findFarthestTarget(sourceToken, targetTokens);
                if (!farthest) return;
            
                // 시위 당기는 소리
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/ArcBowFire.ogg")
                        .delay(800)
                        .volume(this.getEffectVolume(0.5));
            
                // 전기 충전 소리
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/veil_rifle.ogg")
                        .delay(1200)
                        .volume(this.getEffectVolume(0.5));
            
                // 주요 화살 + 전기 효과
                sequence
                    .effect()
                        .file("jb2a.arrow.physical.blue")
                        .atLocation(sourceToken)
                        .stretchTo(farthest)
                        .waitUntilFinished(-1000)
                    .effect()
                        .file("jb2a.chain_lightning.primary.blue")
                        .atLocation(sourceToken)
                        .stretchTo(farthest)
                        .opacity(0.6)
                        .scale(0.6);
            
                // 연쇄 번개 효과
                if (success) {
                    for (const target of targetTokens) {
                        sequence
                            .effect()
                                .file("jb2a.chain_lightning.secondary.blue")
                                .atLocation(farthest)
                                .stretchTo(target, { randomOffset: 0.5 })
                                .delay(800);
                    }
                }
            }
            
            // 유틸리티 함수들도 업데이트
            static _findFarthestTarget(sourceToken, targetTokens) {
                let farthestToken = null;
                let farthestDistance = 0;
                
                for (const token of targetTokens) {
                    const distance = canvas.grid.measureDistance(sourceToken, token);
                    if (distance > farthestDistance) {
                        farthestToken = token;
                        farthestDistance = distance;
                    }
                }
                
                return farthestToken;
            }
            
            static _findNearestTarget(sourceToken, targetTokens) {
                let nearestToken = null;
                let nearestDistance = Infinity;
                
                for (const token of targetTokens) {
                    const distance = canvas.grid.measureDistance(sourceToken, token);
                    if (distance < nearestDistance) {
                        nearestToken = token;
                        nearestDistance = distance;
                    }
                }
                
                return nearestToken;
            }

       // 돌격소총 효과
static async _playAssaultRifleEffect(sequence, sourceToken, targetTokens, success) {
    for (let i = 0; i < targetTokens.length; i++) {
        const target = targetTokens[i];
        
        // 발사음
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/AR_Fire.ogg")
                .volume(this.getEffectVolume(0.5));

        // 첫 발사 효과
        sequence
            .effect()
                .file("jb2a.bullet.01.orange")
                .atLocation(sourceToken)
                .stretchTo(target)
                .missed(!success)
                .name(`impact${i}`)
                .waitUntilFinished(-550);

        // 연발 효과 (3발 추가 발사)
        sequence
            .effect()
                .file("jb2a.bullet.01.orange")
                .atLocation(sourceToken)
                .stretchTo(`impact${i}`, { randomOffset: 0.4, gridUnits: true })
                .repeats(3, 100)
                .waitUntilFinished();
    }
}

static async _playAssimilationMawEffect(sequence, sourceToken, targetTokens, success) {
    for (const target of targetTokens) {
        // 근접 공격음
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/Melee.ogg")
                .volume(this.getEffectVolume(0.5));

        // 물어뜯기 효과
        sequence
            .effect()
                .file("jb2a.bite")
                .atLocation(target)
                .filter("ColorMatrix", { hue: 270 })
                .filter("Glow", { color: 0x8a0303, distance: 2, innerStrength: 2 })
                .zIndex(1)
                .opacity(0.7)
                .scaleToObject(3)
                .waitUntilFinished(!success ? 0 : -1000);

        if (success) {
            // 충격음
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/HeavyImpact.ogg")
                    .volume(this.getEffectVolume(0.5));

            // 신성한 일격 효과
            sequence
                .effect()
                    .file("jb2a.divine_smite.caster.blueyellow")
                    .playbackRate(2.2)
                    .scaleToObject(1.7)
                    .filter("Glow", { color: 0x8a0303, distance: 2, innerStrength: 2 })
                    .filter("ColorMatrix", { hue: 300 })
                    .atLocation(target)
                    .waitUntilFinished(-1000);
        }
    }
}

static async _playAutoPodEffect(sequence, sourceToken, targetTokens, success) {
    for (const target of targetTokens) {
        // 발사음
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/Autopod_Fire.ogg")
                .volume(this.getEffectVolume(0.7));

        // 드론 비행 효과
        sequence
            .effect()
                .file("jb2a.template_circle.vortex.loop.blue")
                .endTime(4700)
                .scale(0.2)
                .tint("#787878")
                .atLocation(sourceToken)
                .moveTowards(target)
                .waitUntilFinished();

        if (success) {
            // 충격음
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Autopod_Impact.ogg")
                    .volume(0.7);

            // 충격 효과
            sequence
                .effect()
                    .file("jb2a.impact.yellow.1")
                    .scale(0.6)
                    .atLocation(target);
        }
    }
}

        // 전투소총/BattleRifle 효과
        static async _playBattleRifleEffect(sequence, sourceToken, targetTokens, success) {
            for (let i = 0; i < targetTokens.length; i++) {
                const target = targetTokens[i];
                
                // 첫 번째 발사
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/BR_Fire.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .duration(933)
                        .delay(500)
                    .effect()
                        .file("jb2a.bullet.03.blue")
                        .atLocation(sourceToken)
                        .scale(0.7)
                        .zIndex(1)
                        .playbackRate(1.5)
                        .stretchTo(target, { randomOffset: 0.6, gridUnits: true })
                        .missed(!success)
                        .name(`hitLocation${i}`)
                        .delay(500)
                        .waitUntilFinished(-600);
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/KineticImpact.ogg")
                            .volume(this.getEffectVolume(0.5))
                        .effect()
                            .file("jb2a.impact.orange.0")
                            .scaleToObject(1.5)
                            .zIndex(2)
                            .atLocation(`hitLocation${i}`)
                            .rotateTowards(sourceToken)
                            .rotate(230)
                            .center();
                }
        
                // 두 번째 발사
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/BR_Fire.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .duration(933)
                        .delay(500)
                    .effect()
                        .file("jb2a.bullet.03.blue")
                        .atLocation(sourceToken)
                        .scale(0.7)
                        .playbackRate(1.5)
                        .stretchTo(target, { randomOffset: 0.6, gridUnits: true })
                        .missed(!success)
                        .name(`hitLocation${i}`)
                        .delay(500)
                        .waitUntilFinished(-600);
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/KineticImpact.ogg")
                            .volume(this.getEffectVolume(0.5))
                        .effect()
                            .file("jb2a.impact.orange.0")
                            .scaleToObject(1.5)
                            .atLocation(`hitLocation${i}`)
                            .rotateTowards(sourceToken)
                            .rotate(230)
                            .center();
                }
            }
        }

    // BlastPick 효과
    static async _playBlastPickEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            // 휘두르기 효과
            sequence
                .effect()
                    .file("jb2a.melee_generic.slash.01.orange")
                    .scaleToObject(4)
                    .atLocation(sourceToken)
                    .spriteOffset({ x: -1.5 }, { gridUnits: true })
                    .rotateTowards(target)
                    .delay(500)
                    .missed(!success)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/bladeswing.ogg")
                    .volume(this.getEffectVolume(0.7))
                    .delay(500)
                    .waitUntilFinished(-1300);
    
            if (success) {
                // 충격 효과
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Mortar_Impact.ogg")
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.explosion.01")
                        .scale(1)
                        .zIndex(2)
                        .atLocation(target, { randomOffset: 0.5, gridUnits: true })
                    .effect()
                        .file("jb2a.static_electricity.03.blue")
                        .scale(0.4)
                        .atLocation(target, { randomOffset: 1, gridUnits: true })
                        .repeats(2, 80)
                        .waitUntilFinished(-800);
            }
        }
    }

    // BoltThrower 효과
    static async _playBoltThrowerEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            // 발사 효과
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/shotgun_fire.ogg")
                    .delay(200)
                    .volume(this.getEffectVolume(0.5))
                .effect()
                    .file("jb2a.bolt.physical.orange")
                    .atLocation(sourceToken)
                    .startTime(500)
                    .stretchTo(target)
                    .missed(!success)
                    .name("bolt")
                    .waitUntilFinished(-400)
                .effect()
                    .file("jb2a.explosion.01.orange")
                    .atLocation("bolt");
    
            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Missile_Impact.ogg")
                        .delay(50)
                        .volume(this.getEffectVolume(0.5));
            }
        }
    }

        // Brood Siblings Molt 효과
        static async _playBroodSiblingsEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                sequence
                    .effect()
                        .file("jb2a.melee_attack.03.greatsword")
                        .tint("#080303")
                        .filter("Glow", { color: 0x8f0f0f })
                        .scaleToObject(4.5)
                        .atLocation(sourceToken)
                        .moveTowards(target)
                        .missed(!success)
                        .waitUntilFinished(-2500)
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/bladeswing.ogg")
                        .delay(500)
                        .volume(this.getEffectVolume(0.7))
                        .waitUntilFinished(-1350);
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/bladehit.ogg")
                            .volume(this.getEffectVolume(0.7))
                        .effect()
                            .file("jb2a.impact.blue")
                            .scaleToObject(2)
                            .atLocation(target)
                            .waitUntilFinished(-1500);
                }
            }
        }
    
        // Cannon Airburst 효과
        static async _playCannonAirburstEffect(sequence, sourceToken, targetTokens, success) {
            if (!targetTokens.length) return;
            
            // 첫 번째 대상의 60% 지점 계산
            const pTarget = targetTokens[0];
            const pBlast = {
                x: sourceToken.x + 0.6 * (pTarget.x - sourceToken.x),
                y: sourceToken.y + 0.6 * (pTarget.y - sourceToken.y),
            };
        
            // 주 발사체
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Missile_Launch.ogg")
                    .volume(this.getEffectVolume(0.5))
                .effect()
                    .file("jb2a.bullet.01.orange")
                    .from(sourceToken)
                    .stretchTo(pBlast)
                    .waitUntilFinished(-200)
                .effect()
                    .file("jb2a.explosion.08")
                    .atLocation(pBlast)
                    .name("impact")
                    .scale(0.8)
                    .zIndex(1)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Flechette.ogg")
                    .volume(this.getEffectVolume(0.5));
        
            // 각 대상에 대한 파편 효과
            for (const target of targetTokens) {
                if (success) {
                    sequence
                        .effect()
                            .file("jb2a.bullet.02.orange")
                            .scale(0.5)
                            .atLocation(pBlast)
                            .stretchTo(target)
                        .effect()
                            .file("jb2a.explosion_side.01")
                            .atLocation(target)
                            .rotateTowards(pBlast)
                            .center()
                            .delay(350)
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/Missile_Impact.ogg")
                            .volume(this.getEffectVolume(0.5))
                            .delay(350);
                }
            }
        }

            // 폭렬발사기/Burst Launcher 효과
            static async _playBurstLauncherEffect(sequence, sourceToken, targetTokens, success) {
                const target = targetTokens[0];  // 첫 번째 대상만 사용
                if (!target) return;
            
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Autopod_Fire.ogg")
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.lightning_ball.blue")
                        .endTime(1500)
                        .scale(0.2)
                        .atLocation(sourceToken)
                        .moveTowards(target)
                        .missed(!success)
                        .waitUntilFinished();
            
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/AirBurst.ogg")
                            .volume(this.getEffectVolume(0.5))
                        .effect()
                            .file("jb2a.explosion.02.blue")
                            .scale(0.5)
                            .atLocation(target)
                            .waitUntilFinished();
                }
            }
        

    // 충전검/Charged Blade 효과
    static async _playChargedBladeEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .effect()
                    .file("jb2a.melee_attack.01.magic_sword.yellow")
                    .filter("ColorMatrix", { hue: 180 })
                    .delay(500)
                    .scaleToObject(4.5)
                    .atLocation(sourceToken)
                    .moveTowards(target)
                    .waitUntilFinished(-1000)
                    .missed(!success)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Axe_swing.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .waitUntilFinished(-1450);
    
            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Melee.ogg")
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.impact.blue.3")
                        .scaleToObject(2)
                        .atLocation(target)
                        .waitUntilFinished(-1200);
            }
        }
    }

    // 전투드릴/Combat Drill 효과
    static async _playCombatDrillEffect(sequence, sourceToken, targetTokens, success) {
        let gridsize = canvas.grid.size;
        let gridscale = gridsize / 100;
    
        for (const target of targetTokens) {
            // 드릴 이미지 효과
            sequence
                .effect()
                    .file("modules/metalic-combat-system/sprites/DRILL.png")
                    .scale(0.6)
                    .filter("Glow", { color: 0xd7d23c })
                    .atLocation(sourceToken)
                    .spriteOffset({ x: -10 * gridscale, y: 10 * gridscale })
                    .moveTowards(target)
                    .missed(!success)
                    .moveSpeed(100)
                    .rotate(140);
    
            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Autopod_Impact.ogg")
                        .volume(this.getEffectVolume(0.7))
                        .repeats(8, 125)
                        .delay(200)
                    .effect()
                        .file("jb2a.gust_of_wind.veryfast")
                        .scale(0.2)
                        .atLocation(sourceToken)
                        .moveTowards(target)
                        .zIndex(2)
                        .delay(50)
                    .effect()
                        .file("jb2a.impact.yellow")
                        .scale(0.4)
                        .delay(200)
                        .zIndex(1)
                        .atLocation(target, { randomOffset: 0.4 })
                        .repeats(8, 125)
                        .waitUntilFinished();
            } else {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Autopod_Impact.ogg")
                        .volume(this.getEffectVolume(0.7))
                        .repeats(2, 170)
                        .delay(200);
            }
        }
    }

       // Displacer (전위기) 효과
       static async _playDisplacerEffect(sequence, sourceToken, targetTokens, success) {
        if (!targetTokens.length) return;
        const pTarget = targetTokens[0];  // 첫 번째 대상 위치 사용
    
        // 발사 단계
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/DisplacerFire.ogg")
                .volume(this.getEffectVolume(0.8))
                .startTime(900)
                .fadeInAudio(300)
            .effect()
                .file("jb2a.dancing_light.purplegreen")
                .tint("#2d0a3d")
                .filter("Glow", { strength: 1, color: 0x34e5d0 })
                .endTime(3000)
                .scale(0.4)
                .atLocation(sourceToken)
                .moveTowards(pTarget)
                .waitUntilFinished();
    
        // 증기 효과
        sequence
            .effect()
                .file("jb2a.fumes.steam.white")
                .fadeIn(1500)
                .fadeOut(1500)
                .atLocation(sourceToken)
                .spriteAnchor({ x: 0.2, y: 1.2 })
                .scaleToObject()
                .opacity(0.7);
    
        // 충격파 효과
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/DisplacerHit2.ogg")
                .volume(this.getEffectVolume(0.8))
            .effect()
                .file("jb2a.divine_smite.caster.blueyellow")
                .tint("#2d0a3d")
                .filter("Glow", { strength: 1, color: 0x34e5d0 })
                .scale(0.9)
                .atLocation(pTarget)
                .waitUntilFinished(-1500);
    
        // 각 대상에 대한 개별 효과
        for (const target of targetTokens) {
            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/DisplacerHit1.ogg")
                        .repeats(6, 200)
                        .volume(this.getEffectVolume(0.6))
                    .effect()
                        .file("jb2a.impact.blue")
                        .tint("#2d0a3d")
                        .filter("Glow", { strength: 2, color: 0x34e5d0 })
                        .scaleToObject(2)
                        .atLocation(target, { randomOffset: 0.9 })
                        .repeats(6, 200);
            }
        }
    }

    // DisruptorWhip (교란채찍) 효과
    static async _playDisruptorWhipEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            // 채찍 효과
            sequence
                .effect()
                    .file("jb2a.divine_smite.target.blueyellow")
                    .scale(0.9)
                    .tint("#8c0353")
                    .atLocation(sourceToken)
                    .moveTowards(target)
                    .moveSpeed(175)
                    .spriteOffset({ x: 0, y: 100, gridUnits: true })
                    .missed(!success)
                    .rotate(90)
                    .delay(500)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/bladeswing.ogg")
                    .delay(500)
                    .volume(this.getEffectVolume(0.7));
    
            if (success) {
                // 타격음
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/bladehit.ogg")
                        .delay(800)
                        .volume(this.getEffectVolume(0.7));
    
                // 펄스 효과
                sequence
                    .effect()
                        .file("jb2a.extras.tmfx.outpulse.circle.01.normal")
                        .atLocation(target, { randomOffset: 0.7, gridUnits: true })
                        .scaleToObject(1.2)
                        .tint("#8c0353")
                        .filter("Glow", { color: 0x8a0303, distance: 1 })
                        .repeats(3, 200)
                        .playbackRate(2)
                        .belowTokens()
                        .delay(800);
    
                // 충격 효과
                sequence
                    .effect()
                        .file("jb2a.impact.001")
                        .scaleToObject(1.2)
                        .tint("#8c0353")
                        .filter("Glow", { color: 0x8a0303, distance: 1 })
                        .atLocation(target, { randomOffset: 0.9, gridUnits: true })
                        .repeats(6, 120)
                        .delay(1200)
                        .waitUntilFinished(-1500);
            }
        }
    }

  // Flamethrower 효과
  static async _playFlamethrowerEffect(sequence, sourceToken, targetTokens, success) {
    const target = targetTokens[0];  // 첫 번째 대상을 방향 기준으로 사용

    sequence
        .effect()
            .file("jb2a.burning_hands.01.orange")
            .atLocation(sourceToken)
            .rotateTowards(target)
            .scale({ x: 0.75, y: 1.0 })
        .sound()
            .file("modules/metalic-combat-system/soundfx/flamethrower_fire.ogg")
            .volume(this.getEffectVolume(0.5))
            .waitUntilFinished(-3000);

    for (let i = 0; i < targetTokens.length; i++) {
        const target = targetTokens[i];
        if (success) {
            sequence
                .effect()
                    .file("jb2a.flames.02.orange")
                    .opacity(0.7)
                    .fadeIn(800)
                    .fadeOut(800)
                    .atLocation(target)
                    .scaleToObject(1.2);
        }
    }
}

static async _playFuelRodEffect(sequence, sourceToken, targetTokens, success) {
    const target = targetTokens[0];
    
    sequence
        .sound()
            .file("modules/metalic-combat-system/soundfx/APR2_Load.ogg")
            .volume(this.getEffectVolume(0.5))
            .waitUntilFinished()
        .sound()
            .file("modules/metalic-combat-system/soundfx/APR2_Fire.ogg")
            .volume(this.getEffectVolume(0.5))
        .effect()
            .file("jb2a.lasershot.green")
            .atLocation(sourceToken)
            .stretchTo(target)
            .missed(!success)
            .scale(2.0)
            .waitUntilFinished(-400);

    if (success) {
        sequence
            .effect()
                .file("jb2a.toll_the_dead.green.shockwave")
                .atLocation(target)
                .scale(0.7)
                .zIndex(1)
            .effect()
                .file("jb2a.smoke.puff.side.02.white")
                .atLocation(target)
                .rotateTowards(sourceToken)
                .rotate(180)
                .zIndex(1)
                .tint("#43b918")
            .sound()
                .file("modules/metalic-combat-system/soundfx/APR2_Impact.ogg")
                .volume(this.getEffectVolume(0.5));
    }
}

    
        // Hammer (망치) 효과
        static async _playHammerEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                sequence
                    .effect()
                        .file("jb2a.melee_attack.03.maul.01")
                        .atLocation(sourceToken)
                        .spriteOffset({ x: -0.3 }, { gridUnits: true })
                        .moveTowards(target)
                        .missed(!success)
                        .waitUntilFinished(-1100);
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Axe_swing.ogg")
                        .volume(this.getEffectVolume(0.7))
                        .waitUntilFinished(-1800);
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/HammerImpact.ogg")
                            .volume(this.getEffectVolume(0.9));
                    sequence
                        .effect()
                            .file("jb2a.impact.ground_crack.orange.01")
                            .atLocation(target)
                            .belowTokens()
                            .scaleToObject(3)
                            .waitUntilFinished(-6000);
                }
            }
        }

        static async _playHMGEffect(sequence, sourceToken, targetTokens, success) {
            for (let i = 0; i < targetTokens.length; i++) {
                const target = targetTokens[i];
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/AssaultCannonFire.ogg")
                        .volume(this.getEffectVolume(0.5));
                sequence
                    .effect()
                        .file("jb2a.bullet.01.orange")
                        .atLocation(sourceToken)
                        .stretchTo(target)
                        .missed(!success)
                        .name(`impact${i}`)
                        .scale(0.5)
                        .waitUntilFinished(-800);
                sequence
                    .effect()
                        .file("jb2a.bullet.01.orange")
                        .atLocation(sourceToken)
                        .stretchTo(`impact${i}`, { randomOffset: 0.4, gridUnits: true })
                        .repeats(7, 50)
                        .scale(0.5)
                        .waitUntilFinished();
            }
        }

        static async _playImpactLanceEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Annihilator_Charge.ogg")
                        .volume(this.getEffectVolume(0.5));
                sequence
                    .effect()
                        .file("jb2a.disintegrate.green")
                        .startTime(900)
                        .scale(0.86)
                        .atLocation(sourceToken)
                        .stretchTo(target)
                        .missed(!success)
                        .name("impact")
                        .waitUntilFinished(-3100);
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/Annihilator.ogg")
                            .volume(this.getEffectVolume(0.5));
                    sequence
                        .effect()
                            .file("jb2a.impact.blue.3")
                            .scale(1.0)
                            .tint("#c91af9")
                            .atLocation(target)
                            .waitUntilFinished(-400);
                } else {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/Annihilator.ogg")
                            .volume(this.getEffectVolume(0.5));
                    sequence
                        .effect()
                            .file("jb2a.impact.blue.3")
                            .scale(1.0)
                            .tint("#c91af9")
                            .atLocation("impact")
                            .waitUntilFinished(-400);
                }
            }
        }
        
        static async _playKraulRifleEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/WeaponClick.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .waitUntilFinished(200)
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/AMR_Fire.ogg")
                        .volume(this.getEffectVolume(0.5));
        
                sequence
                    .effect()
                        .file("jb2a.bullet.Snipe.blue")
                        .filter("ColorMatrix", { hue: 200 })
                        .atLocation(sourceToken)
                        .stretchTo(target)
                        .missed(!success);
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/AMR_Impact.ogg")
                            .volume(this.getEffectVolume(0.5))
                            .delay(75);
                    sequence
                        .effect()
                            .file("jb2a.impact.orange.0")
                            .atLocation(target)
                            .rotateTowards(sourceToken)
                            .rotate(230)
                            .center()
                            .delay(75)
                            .waitUntilFinished();
                }
            }
        }

        static async _playLaserEffect(sequence, sourceToken, targetTokens, success) {
            // 200-300ms 사이의 랜덤 간격
            const random = Math.floor(Math.random() * (300 - 200 + 1) + 200);  // 200-300 사이 랜덤값

            for (let i = 0; i < targetTokens.length; i++) {
                const target = targetTokens[i];
                
                // 레이저 발사음
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Laser_Fire.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .duration(633)
                        .repeats(3, random);
        
                // 충격 효과
                sequence
                    .effect()
                        .file("jb2a.impact.blue.2")
                        .playIf(success)
                        .atLocation(`impact${i}`)
                        .scaleToObject(2)
                        .repeats(3, random)
                        .delay(300);
        
                // 레이저 발사 효과
                sequence
                    .effect()
                        .file("jb2a.lasershot.blue")
                        .atLocation(sourceToken)
                        .stretchTo(target, { randomOffset: 0.4 })
                        .missed(!success)
                        .name(`impact${i}`)
                        .repeats(3, random)
                        .waitUntilFinished();
            }
        }
        
        static async _playLatchDroneEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                // 드론 발사 효과
                sequence
                    .effect()
                        .file("modules/metalic-combat-system/sprites/LatchDrone.png")
                        .rotate(260)
                        .atLocation(sourceToken)
                        .rotateTowards(target)
                        .moveTowards(target)
                        .missed(!success)
                        .moveSpeed(1200);
        
                // 발사음
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Mortar_Launch.ogg")
                        .volume(this.getEffectVolume(0.7))
                        .waitUntilFinished();
        
                if (success) {
                    // 안정화 효과
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/Stabilize.ogg")
                            .volume(this.getEffectVolume(0.9))
                            .delay(200)
                        .effect()
                            .file("jb2a.healing_generic.400px.green")
                            .atLocation(target)
                            .scale(0.5)
                            .delay(200)
                            .waitUntilFinished();
                }
            }
        }
        
        static async _playLeviathanEffect(sequence, sourceToken, targetTokens, success) {
            for (let i = 0; i < targetTokens.length; i++) {
                const target = targetTokens[i];
        
                // 발사음
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Leviathan.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .delay(500)
                        .waitUntilFinished(-2100);
        
                // 주 발사 효과
                sequence
                    .effect()
                        .file("jb2a.bullet.01.orange")
                        .atLocation(sourceToken)
                        .stretchTo(target, { randomOffset: 0.3 })
                        .missed(!success)
                        .name(`impact${i}`)
                        .scale(0.5)
                        .waitUntilFinished(-775);
        
                // 연속 발사 효과
                sequence
                    .effect()
                        .file("jb2a.bullet.01.orange")
                        .atLocation(sourceToken)
                        .stretchTo(`impact${i}`, { randomOffset: 0.6, gridUnits: true })
                        .repeats(7, 30)
                        .scale(0.5)
                        .waitUntilFinished();
            }
        }

        static async _playCyclonePulseRifleEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                // 발사음
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/CPR_Fire.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .repeats(5, 125);
        
                // 발사 효과
                sequence
                    .effect()
                        .file("jb2a.magic_missile.purple")
                        .filter("ColorMatrix", { hue: 220 })
                        .atLocation(sourceToken)
                        .stretchTo(target, { randomOffset: 0.4 })
                        .missed(!success)
                        .repeats(5, 125)
                        .waitUntilFinished(-1600);
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/CPR_Impact.ogg")
                            .volume(this.getEffectVolume(0.5))
                            .repeats(5, 125)
                            .waitUntilFinished();
                }
            }
        }

        static async _playCyclonePulseRifleEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                // 발사음
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/CPR_Fire.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .repeats(5, 125);
        
                // 발사 효과
                sequence
                    .effect()
                        .file("jb2a.magic_missile.purple")
                        .filter("ColorMatrix", { hue: 220 })
                        .atLocation(sourceToken)
                        .stretchTo(target, { randomOffset: 0.4 })
                        .missed(!success)
                        .repeats(5, 125)
                        .waitUntilFinished(-1600);
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/CPR_Impact.ogg")
                            .volume(this.getEffectVolume(0.5))
                            .repeats(5, 125)
                            .waitUntilFinished();
                }
            }
        }
        
        static async _playDD288Effect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                // 메인 사운드
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/DD288Full.ogg")
                        .volume(this.getEffectVolume(0.6))
                        .waitUntilFinished(-3400);
        
                // 타격 효과
                sequence
                    .effect()
                        .file("jb2a.unarmed_strike.physical.01.blue")
                        .filter("ColorMatrix", { hue: 0o0, brightness: 0.5 })
                        .filter("Glow", { distance: 3, color: 0xe99649, innerStrength: 2 })
                        .atLocation(sourceToken)
                        .playbackRate(0.7)
                        .scale(8)
                        .stretchTo(target)
                        .missed(!success)
                        .name("impact")
                        .waitUntilFinished(-650);
        
                // 폭발 효과
                sequence
                    .effect()
                        .file("jb2a.explosion_side.01.orange")
                        .scaleToObject(6)
                        .atLocation("impact")
                        .rotateTowards(sourceToken)
                        .rotate(180)
                        .spriteOffset({ x: -2.9 }, { gridUnits: true })
                        .zIndex(1);
        
                if (success) {
                    sequence
                        .effect()
                            .file("jb2a.explosion.side_fracture.flask.01")
                            .scaleToObject(3)
                            .atLocation("impact")
                            .rotateTowards(sourceToken)
                            .rotate(180)
                            .delay(200);
                }
            }
        }   

        static async _playDefaultMeleeEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                sequence
                    .effect()
                        .file("jb2a.melee_generic.slash.01.orange")
                        .atLocation(sourceToken)
                        .spriteOffset({ x: -0.2 }, { gridUnits: true })
                        .stretchTo(target)
                        .delay(500)
                        .missed(!success)
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/bladeswing.ogg")
                        .volume(this.getEffectVolume(0.7))
                        .delay(500)
                        .waitUntilFinished(-1300);
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/bladehit.ogg")
                            .volume(this.getEffectVolume(0.7))
                        .effect()
                            .file("jb2a.static_electricity.03.blue")
                            .scaleToObject(0.5)
                            .atLocation(target, { randomOffset: 0.8, gridUnits: true })
                            .repeats(2, 80)
                            .waitUntilFinished(-2200);
                }
            }
        }
        
        static async _playDefaultTechEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                // 준비 단계
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/TechPrepare.ogg")
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.extras.tmfx.outpulse.circle.02.normal")
                        .scaleToObject(2.5)
                        .filter("Glow", { color: 0x36c11a })
                        .playbackRate(1.3)
                        .atLocation(sourceToken)
                        .waitUntilFinished(-400);
        
                // 경고 단계
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/TechWarn.ogg")
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.extras.tmfx.inpulse.circle.02.normal")
                        .scaleToObject()
                        .repeats(3, 75)
                        .playbackRate(1.5)
                        .atLocation(target, { randomOffset: 0.7, gridUnits: true })
                        .filter("Glow", { color: 0x36c11a })
                        .missed(!success)
                        .waitUntilFinished();
        
                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/NexusConfirm.ogg")
                            .volume(this.getEffectVolume(0.5))
                        .effect()
                            .file("jb2a.zoning.inward.circle.loop.bluegreen.01.01")
                            .scale(0.4)
                            .fadeOut(3800, { ease: "easeOutBack" })
                            .belowTokens()
                            .atLocation(target)
                            .waitUntilFinished(-2200)
                        .effect()
                            .file("jb2a.static_electricity.03.blue")
                            .scaleToObject(1.1)
                            .atLocation(target);
                }
            }
        }

        static async _playMissileEffect(sequence, sourceToken, targetTokens, success) {
            for (const target of targetTokens) {
                // 발사음
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Missile_Launch.ogg")
                        .volume(this.getEffectVolume(0.5));
    
                // 비행음
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Missile_Travel.ogg")
                        .volume(this.getEffectVolume(0.5));
    
                // 미사일 발사 효과
                sequence
                    .effect()
                        .file("jb2a.pack_hound_missile")
                        .atLocation(sourceToken)
                        .stretchTo(target)
                        .missed(!success)
                        .waitUntilFinished(-3200);
    
                // 폭발 효과
                sequence
                    .effect()
                        .file("jb2a.explosion.01.orange")
                        .atLocation(target)
                        .scale(1.2)
                        .zIndex(1)
                        .waitUntilFinished(-1300);
    
                if (success) {
                    // 명중음
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/Missile_Impact.ogg")
                            .volume(this.getEffectVolume(0.5));
                }
            }
        }

        
    static async _playMissilePinakaEffect(sequence, sourceToken, targetTokens, success) {
        // 대상을 2그룹으로 나누기
        const groups = this._splitTargetsIntoGroups(targetTokens, 2);

        for (const targets of groups) {
            for (const target of targets) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Missile_Launch.ogg")
                        .volume(this.getEffectVolume(0.5));

                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Missile_Travel.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .timeRange(700, 2000);

                sequence
                    .effect()
                        .file("jb2a.throwable.launch.missile")
                        .atLocation(sourceToken)
                        .stretchTo(target)
                        .waitUntilFinished();

                if (success) {
                    sequence
                        .sound()
                            .file("modules/metalic-combat-system/soundfx/Missile_Impact.ogg")
                            .volume(this.getEffectVolume(0.5));

                    sequence
                        .effect()
                            .file("jb2a.explosion.01.orange")
                            .atLocation(target)
                            .scale(1.2)
                            .zIndex(2);

                    sequence
                        .effect()
                            .file("jb2a.explosion.08.orange")
                            .atLocation(target)
                            .scale(1.2)
                            .zIndex(1);
                }
            }
        }
    }

    static async _playMissilesEffect(sequence, sourceToken, targetTokens, success) {
        for (let i = 0; i < targetTokens.length; i++) {
            const target = targetTokens[i];

            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Missile_Launch.ogg")
                    .volume(this.getEffectVolume(0.5));

            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Missile_Travel.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .timeRange(700, 2000);

            sequence
                .effect()
                    .file("jb2a.pack_hound_missile")
                    .atLocation(sourceToken)
                    .stretchTo(target)
                    .missed(!success)
                    .name(`impact${i}`)
                    .waitUntilFinished(-3200);

            sequence
                .effect()
                    .file("jb2a.explosion.01.orange")
                    .atLocation(`impact${i}`)
                    .scale(0.8)
                    .zIndex(1)
                    .waitUntilFinished(-1300);

            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Missile_Impact.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .waitUntilFinished(-8500);
            }
        }
    }

    static async _playMortarEffect(sequence, sourceToken, targetTokens, success) {
        if (!targetTokens.length) return;

        // 중심점 계산 (첫 번째 대상 사용)
        const centerTarget = targetTokens[0];

        // 발사 효과
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/Mortar_Launch.ogg")
                .volume(this.getEffectVolume(0.5));

        // 연기 효과
        sequence
            .effect()
                .file("jb2a.smoke.puff.side.02.white")
                .atLocation(sourceToken)
                .rotateTowards(centerTarget)
                .scale({ y: 0.5 });

        // 발사체 효과
        sequence
            .effect()
                .file("jb2a.bullet.02.orange")
                .atLocation(sourceToken)
                .stretchTo(centerTarget)
                .playbackRate(0.7)
                .waitUntilFinished(-650);

        // 중심점 폭발
        sequence
            .effect()
                .file("jb2a.explosion.shrapnel.bomb.01.black")
                .atLocation(centerTarget)
                .scale(0.5);

        sequence
            .effect()
                .file("jb2a.explosion.08.orange")
                .atLocation(centerTarget)
                .rotateTowards(sourceToken)
                .rotate(180)
                .center();

        if (success) {
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Mortar_Impact.ogg")
                    .volume(this.getEffectVolume(0.5));

            // 각 대상에 대한 폭발 효과
            for (const target of targetTokens) {
                sequence
                    .effect()
                        .file("jb2a.explosion_side.01.orange")
                        .atLocation(target)
                        .rotateTowards(centerTarget)
                        .scale(0.7)
                        .center();
            }
        }
    }
    
    // 유틸리티 함수: 대상들을 지정된 수의 그룹으로 나누기
    static _splitTargetsIntoGroups(targets, numGroups) {
        const groups = Array(numGroups).fill().map(() => []);
        targets.forEach((target, index) => {
            groups[index % numGroups].push(target);
        });
        return groups;
    }

    static async _playNanobotWhipEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .effect()
                    .file("jb2a.divine_smite.target.blueyellow")
                    .scale(0.9)
                    .tint("#066605")
                    .atLocation(sourceToken)
                    .moveTowards(target)
                    .moveSpeed(300)
                    .spriteOffset({ x: 0, y: 100, gridUnits: true })
                    .missed(!success)
                    .rotate(90)
                    .delay(500)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/bladeswing.ogg")
                    .delay(500)
                    .volume(this.getEffectVolume(0.7));

            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/bladehit.ogg")
                        .delay(800)
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.impact.blue")
                        .scale(0.5)
                        .tint("#066605")
                        .atLocation(target, { randomOffset: 1 })
                        .repeats(4, 80)
                        .delay(1200)
                        .waitUntilFinished(-1500);
            }
        }
    }

    static async _playNeedleBeamEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Annihilator_Charge.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .waitUntilFinished(-1200)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Plasma_Fire.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .repeats(2, 225)
                .effect()
                    .file("jb2a.lasershot.green")
                    .atLocation(sourceToken)
                    .stretchTo(target)
                    .missed(!success)
                    .repeats(2, 225)
                    .waitUntilFinished(-350);

            if (success) {
                sequence
                    .effect()
                        .file("jb2a.impact.orange.0")
                        .atLocation(target)
                        .rotateTowards(sourceToken)
                        .rotate(230)
                        .center()
                        .tint("#1aff34")
                        .scale(0.8);
            }
        }
    }

    static async _playNexusEffect(sequence, sourceToken, targetTokens, success) {
        if (!targetTokens.length) return;

        // 70% 지점 계산
        const pTarget = targetTokens[0];
        const pBlast = {
            x: sourceToken.x + 0.7 * (pTarget.x - sourceToken.x),
            y: sourceToken.y + 0.7 * (pTarget.y - sourceToken.y)
        };

        // 준비 단계
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/NexusReady.ogg")
                .volume(this.getEffectVolume(0.5))
                .waitUntilFinished();

        // 발사 단계
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/NexusFire.ogg")
                .volume(this.getEffectVolume(0.5))
                .repeats(3, 150)
            .effect()
                .file("jb2a.bullet.01.orange")
                .filter("ColorMatrix", { hue: 0o70 })
                .filter("Blur", { blur: 8, strength: 10, blurX: 4 })
                .atLocation(sourceToken)
                .stretchTo(pBlast, { randomOffset: 0.6 })
                .repeats(3, 150)
                .waitUntilFinished(-800);

        // 연기 효과
        sequence
            .effect()
                .file("jb2a.side_impact.part.smoke.blue")
                .filter("ColorMatrix", { hue: 230, brightness: 0.5 })
                .scale(0.8)
                .atLocation(pBlast, { randomOffset: 0.1 })
                .rotateTowards(pTarget)
                .repeats(3, 150)
                .waitUntilFinished(-2200);

        // 각 대상에 대한 효과
        for (const target of targetTokens) {
            if (success) {
                sequence
                    .effect()
                        .file("jb2a.impact.004.blue")
                        .filter("ColorMatrix", { hue: 235, brightness: 0.5 })
                        .scale(0.5)
                        .zIndex(1)
                        .atLocation(target, { randomOffset: 0.5, gridUnits: true })
                        .repeats(3, 100)
                    .effect()
                        .file("jb2a.zoning.inward.circle.loop")
                        .scale(0.4)
                        .fadeOut(3800, { ease: "easeOutBack" })
                        .belowTokens()
                        .atLocation(target)
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/NexusConfirm.ogg")
                        .volume(this.getEffectVolume(0.5));
            }
        }
    }    

    static async _playPistolEffect(sequence, sourceToken, targetTokens, success) {
        // 300-500 사이의 랜덤 간격
        const random = Math.floor(Math.random() * (500 - 300 + 1) + 300);

        for (const target of targetTokens) {
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/pistol_fire.ogg")
                    .repeats(3, random)
                    .volume(this.getEffectVolume(0.5));

            sequence
                .effect()
                    .file("jb2a.bullet.01.orange")
                    .atLocation(sourceToken)
                    .scale(0.5)
                    .stretchTo(target, { randomOffset: 0.4 })
                    .missed(!success)
                    .repeats(3, random)
                    .waitUntilFinished(-100);
        }
    }

    static async _playPlasmaMaulEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .effect()
                    .file("jb2a.melee_attack.03.maul.01")
                    .filter("Glow", {
                        color: 0x18f014,
                        innerStrength: 1.5,
                        knockout: false,
                        quality: 0.1,
                        distance: 50,
                    })
                    .tint("#18f014")
                    .atLocation(sourceToken)
                    .spriteOffset({ x: -0.3 }, { gridUnits: true })
                    .moveTowards(target)
                    .missed(!success)
                    .waitUntilFinished(-1100);

            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Axe_swing.ogg")
                    .volume(this.getEffectVolume(0.7))
                    .waitUntilFinished(-1800);

            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/HammerImpact.ogg")
                        .volume(this.getEffectVolume(0.9));

                sequence
                    .effect()
                        .file("jb2a.impact.ground_crack.orange.01")
                        .tint("#18f014")
                        .atLocation(target)
                        .belowTokens()
                        .scaleToObject(3)
                        .waitUntilFinished(-4000);
            }
        }
    }

    static async _playPlasmaRifleEffect(sequence, sourceToken, targetTokens, success) {
        const random = Math.floor(Math.random() * (400 - 300 + 1) + 300);

        for (let i = 0; i < targetTokens.length; i++) {
            const target = targetTokens[i];
            
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Plasma_Fire.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .duration(633)
                    .repeats(2, random);

            sequence
                .effect()
                    .file("jb2a.impact.004.blue")
                    .playIf(success)
                    .atLocation(`impact${i}`)
                    .tint("#1aff34")
                    .scaleToObject(2)
                    .repeats(2, random)
                    .delay(300)
                    .playbackRate(1.5);

            sequence
                .effect()
                    .file("jb2a.lasershot.green")
                    .atLocation(sourceToken)
                    .stretchTo(target, { randomOffset: 0.3, gridUnits: true })
                    .missed(!success)
                    .name(`impact${i}`)
                    .repeats(2, random)
                    .waitUntilFinished();
        }
    }

    static async _playPlasmaTalonsEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .effect()
                    .file("jb2a.claws.400px.red")
                    .tint("#720d87")
                    .scale(0.8)
                    .zIndex(1)
                    .opacity(0.6)
                    .atLocation(target)
                    .missed(!success);

            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Melee.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .repeats(2, 250);

            if (success) {
                sequence
                    .effect()
                        .file("jb2a.impact.blue.2")
                        .scale(1.0)
                        .tint("#c91af9")
                        .atLocation(target, { randomOffset: 0.1 })
                        .delay(200)
                        .repeats(2, 250);
            }
        }
    }

    static async _playPlasmaThrowerEffect(sequence, sourceToken, targetTokens, success) {
        if (!targetTokens.length) return;
        const target = targetTokens[0]; // 첫 번째 대상을 방향 기준으로 사용

        // 메인 발사 효과
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/flamethrower_fire.ogg")
                .volume(this.getEffectVolume(0.5));

        sequence
            .effect()
                .file("jb2a.breath_weapons02.burst.cone.fire.orange.02")
                .atLocation(sourceToken)
                .filter("ColorMatrix", { hue: 270 })
                .filter("Glow", { distance: 3, color: 0xe99649, innerStrength: 2 })
                .scale({ x: 0.9 })
                .playbackRate(1.6)
                .rotateTowards(target)
                .waitUntilFinished(-3500);

        // 각 대상에 대한 불꽃 효과
        for (const target of targetTokens) {
            if (success) {
                sequence
                    .effect()
                        .file("jb2a.flames.02.orange")
                        .filter("ColorMatrix", { hue: 270 })
                        .filter("Glow", { distance: 3, color: 0xe99649, innerStrength: 2 })
                        .opacity(0.7)
                        .fadeIn(800)
                        .fadeOut(800)
                        .atLocation(target)
                        .scaleToObject(1.2);
            }
        }
    }

    static async _playPlasmaTorchEffect(sequence, sourceToken, targetTokens, success) {
        if (!targetTokens.length) return;
        const target = targetTokens[0];

        sequence
            .effect()
                .file("jb2a.fire_jet.orange")
                .filter("ColorMatrix", { hue: 210 })
                .filter("Glow", { distance: 3, color: 0xe99649, innerStrength: 2 })
                .atLocation(sourceToken)
                .stretchTo(target)
            .sound()
                .file("modules/metalic-combat-system/soundfx/flamethrower_fire.ogg")
                .volume(this.getEffectVolume(0.5));
    }

    static async _playPPCEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/PPC2.ogg")
                    .delay(400)
                    .volume(this.getEffectVolume(0.5));

            sequence
                .effect()
                    .file("jb2a.chain_lightning.primary.blue")
                    .scale(0.7)
                    .atLocation(sourceToken)
                    .stretchTo(target)
                    .missed(!success);
        }
    }

    static async _playRailgunEffect(sequence, sourceToken, targetTokens, success) {
        if (!targetTokens.length) return;

        // 가장 먼 대상 찾기
        const target = this._findFarthestTarget(sourceToken, targetTokens);

        // 충전 단계
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/Annihilator_Charge.ogg")
                .volume(this.getEffectVolume(0.5))
                .waitUntilFinished(-500);

        // 발사 단계
        sequence
            .effect()
                .file("jb2a.bullet.Snipe.blue")
                .atLocation(sourceToken)
                .stretchTo(target)
            .sound()
                .file("modules/metalic-combat-system/soundfx/AMR_Fire.ogg")
                .volume(this.getEffectVolume(0.5))
            .sound()
                .file("modules/metalic-combat-system/soundfx/AMR_Impact.ogg")
                .volume(this.getEffectVolume(0.5));

        // 관통 효과
        if (success) {
            for (const target of targetTokens) {
                sequence
                    .effect()
                        .file("jb2a.impact.orange.0")
                        .atLocation(target)
                        .rotateTowards(sourceToken)
                        .rotate(230)
                        .center();
            }
        }
    }

    static async _playRetortLoopEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/RetortLoop.ogg")
                    .volume(this.getEffectVolume(0.8));

            sequence
                .effect()
                    .file("jb2a.energy_beam.normal.bluepink.02")
                    .scale(0.7)
                    .atLocation(sourceToken)
                    .stretchTo(target)
                    .missed(!success)
                    .name("impact")
                    .delay(200);

            if (success) {
                sequence
                    .effect()
                        .file("jb2a.impact.blue")
                        .scale(0.3)
                        .atLocation(target, { randomOffset: 0.9 })
                        .repeats(8, 200)
                        .delay(700);
            } else {
                sequence
                    .effect()
                        .file("jb2a.impact.blue")
                        .scale(0.3)
                        .atLocation("impact", { randomOffset: 0.9 })
                        .repeats(8, 200)
                        .delay(700);
            }
        }
    }

    static async _playShockBatonEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .effect()
                    .file("jb2a.melee_attack.01.magic_sword.yellow")
                    .delay(500)
                    .scaleToObject(3)
                    .filter("ColorMatrix", { hue: 180 })
                    .atLocation(sourceToken)
                    .moveTowards(target)
                    .waitUntilFinished(-1000)
                    .missed(!success);

            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Axe_swing.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .waitUntilFinished(-1450);

            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Melee.ogg")
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.impact.blue.2")
                        .scaleToObject()
                        .atLocation(target, { randomOffset: 0.5, gridUnits: true })
                        .waitUntilFinished(-1200)
                    .effect()
                        .file("jb2a.static_electricity.03")
                        .scaleToObject(0.7)
                        .atLocation(target, { randomOffset: 0.6, gridUnits: true })
                        .repeats(3, 75)
                        .waitUntilFinished(-1200);
            }
        }
    }

    static async _playShotgunEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/shotgun_cycle.ogg")
                    .volume(this.getEffectVolume(0.5));

            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/shotgun_fire.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .delay(500);

            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/shotgun_impact.ogg")
                        .volume(this.getEffectVolume(0.5))
                        .delay(800);
            }

            sequence
                .effect()
                    .file("jb2a.bullet.01.orange")
                    .atLocation(sourceToken)
                    .scale(0.9)
                    .stretchTo(target, { randomOffset: 0.7 })
                    .missed(!success)
                    .repeats(6)
                    .delay(500)
                    .waitUntilFinished(-100);
        }
    }

    static async _playSlagCannonEffect(sequence, sourceToken, targetTokens, success) {
        if (!targetTokens.length) return;
        const target = targetTokens[0];  // 첫 번째 대상을 방향 기준으로 사용

        // 주 발사 효과
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/RetortLoop.ogg")
                .volume(this.getEffectVolume(0.5));

        sequence
            .effect()
                .file("jb2a.breath_weapons02.burst.line")
                .atLocation(sourceToken)
                .filter("ColorMatrix", { hue: 180, brightness: 0.2, contrast: 0.5 })
                .filter("Glow", { distance: 0.5, color: 0xd6c194, innerStrength: 2 })
                .stretchTo(target)
                .playbackRate(1.5)
                .waitUntilFinished(-3500);

        // 각 대상에 대한 슬래그 효과
        if (success) {
            for (const target of targetTokens) {
                sequence
                    .effect()
                        .file("jb2a.grease.dark_brown.loop")
                        .opacity(0.8)
                        .fadeIn(800)
                        .fadeOut(800)
                        .atLocation(target, { randomOffset: 2, gridUnits: true })
                        .belowTokens()
                        .repeats(3)
                        .scaleToObject(1);
            }
        }
    }

    static async _playTachyonLanceEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            // 충전 단계
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Annihilator_Charge.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .waitUntilFinished();

            // 타격 효과
            sequence
                .effect()
                    .file("jb2a.impact.orange.0")
                    .atLocation(target, { randomOffset: 0.7 }, { gridUnits: true })
                    .rotateTowards(sourceToken)
                    .missed(!success)
                    .rotate(230)
                    .center();

            // 발사음
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Annihilator.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .waitUntilFinished(-2800);
        }
    }

    static async _playTempestBladeEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            // 검 휘두르기 효과
            sequence
                .effect()
                    .file("jb2a.melee_attack.01.magic_sword.yellow")
                    .delay(500)
                    .scaleToObject(6)
                    .filter("ColorMatrix", { hue: 180 })
                    .atLocation(sourceToken)
                    .moveTowards(target)
                    .waitUntilFinished(-1000)
                    .missed(!success)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Axe_swing.ogg")
                    .volume(this.getEffectVolume(0.5))
                    .waitUntilFinished(-1450);

            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Melee.ogg")
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.impact.blue.3")
                        .scaleToObject(2)
                        .atLocation(target)
                        .waitUntilFinished(-1200)
                    .effect()
                        .file("jb2a.static_electricity.03")
                        .scaleToObject()
                        .atLocation(target, { randomOffset: 0.8, gridUnits: true })
                        .repeats(3, 75)
                        .opacity(0.8)
                        .waitUntilFinished(-1200);
            }
        }
    }

    static async _playThermalRifleEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            // 준비음
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/WeaponBeep.ogg")
                    .volume(this.getEffectVolume(0.5));

            // 발사음
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Thermal_Rifle_Fire.ogg")
                    .delay(400)
                    .volume(this.getEffectVolume(0.5));

            // 열선 효과
            sequence
                .effect()
                    .file("jb2a.fireball.beam.orange")
                    .scale(1.25)
                    .startTime(1500)
                    .atLocation(sourceToken)
                    .stretchTo(target)
                    .missed(!success)
                    .name("impact");

            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Thermal_Rifle_Hit.ogg")
                        .delay(700)
                        .volume(this.getEffectVolume(0.5))
                    .effect()
                        .file("jb2a.impact.orange.0")
                        .atLocation("impact")
                        .rotateTowards(sourceToken)
                        .rotate(230)
                        .center()
                        .scaleToObject(1.5)
                        .delay(700)
                        .waitUntilFinished();
            }
        }
    }

    static async _playTorchEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .effect()
                    .file("jb2a.greataxe.melee.standard.white")
                    .tint("#c91af9")
                    .scale(0.8)
                    .atLocation(sourceToken)
                    .moveTowards(target)
                    .missed(!success)
                    .waitUntilFinished(-1200)
                .sound()
                    .file("modules/metalic-combat-system/soundfx/Axe_swing.ogg")
                    .volume(this.getEffectVolume(0.7));

            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/Axe_Hit.ogg")
                        .delay(275)
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.impact.blue.3")
                        .delay(275)
                        .scaleToObject(2)
                        .tint("#c91af9")
                        .atLocation(target)
                        .waitUntilFinished(-1000);
            }
        }
    }

    static async _playVeilRifleEffect(sequence, sourceToken, targetTokens, success) {
        if (!targetTokens.length) return;

        // 가장 먼 대상 찾기
        const farthest = this._findFarthestTarget(sourceToken, targetTokens);

        for (const target of targetTokens) {
            sequence
                .effect()
                    .file("jb2a.bullet.Snipe.blue")
                    .filter("ColorMatrix", { hue: 60 })
                    .filter("Glow", { distance: 3 })
                    .atLocation(sourceToken)
                    .scale(0.8)
                    .stretchTo(farthest)
                    .missed(!success);

            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/veil_rifle.ogg")
                    .volume(this.getEffectVolume(0.5));
        }
    }

    static async _playWarPikeEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .effect()
                    .file("jb2a.spear.melee.01.white.2")
                    .filter("Glow", {
                        color: 0x5f5858,
                        innerStrength: 2,
                        knockout: true,
                        distance: 20,
                    })
                    .scale(0.8)
                    .atLocation(sourceToken)
                    .moveTowards(target)
                    .missed(!success);

            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/bladeswing.ogg")
                    .delay(950)
                    .endTime(600)
                    .volume(this.getEffectVolume(0.7))
                    .waitUntilFinished(-800);

            if (success) {
                sequence
                    .sound()
                        .file("modules/metalic-combat-system/soundfx/bladehit.ogg")
                        .volume(this.getEffectVolume(0.7))
                    .effect()
                        .file("jb2a.impact.orange.3")
                        .scaleToObject(2)
                        .atLocation(target)
                        .waitUntilFinished();
            }
        }
    }

    static async _playWarpRifleEffect(sequence, sourceToken, targetTokens, success) {
        if (!targetTokens.length) return;
        const target = targetTokens[0];  // 첫 번째 대상 사용

        // 발사 효과
        sequence
            .sound()
                .file("modules/metalic-combat-system/soundfx/DisplacerFire.ogg")
                .volume(this.getEffectVolume(0.8))
                .startTime(900)
                .fadeInAudio(500)
            .effect()
                .file("jb2a.energy_strands.range.multiple.purple.01")
                .scale(0.4)
                .atLocation(sourceToken)
                .stretchTo(target)
                .missed(!success)
                .waitUntilFinished(-1100);

        // 명중 효과
        if (success) {
            sequence
                .sound()
                    .file("modules/metalic-combat-system/soundfx/DisplacerHit2.ogg")
                    .delay(300)
                .effect()
                    .file("jb2a.divine_smite.caster.blueyellow")
                    .volume(this.getEffectVolume(0.8))
                    .scaleToObject(3)
                    .tint("#9523e1")
                    .filter("Glow", { color: 0xffffff, distance: 1 })
                    .atLocation(target)
                    .waitUntilFinished(-1000);
        }
    }
    
    // 기본 효과
    static async _playDefaultEffect(sequence, sourceToken, targetTokens, success) {
        for (const target of targetTokens) {
            sequence
                .effect()
                    .file("jb2a.impact.blue.0")
                    .atLocation(sourceToken)
                    .stretchTo(target);

            if (success) {
                sequence
                    .effect()
                        .file("jb2a.impact.blue.0")
                        .atLocation(target)
                        .scale(0.5)
                        .delay(50);
            }
        }
    }
}