export class SyncManager {
    static socket = null;
    static processedUpdates = new Map();
    static syncing = false;

    static initialize(socketlib) {
        if (!socketlib) {
            console.error('[SyncManager] No socketlib provided');
            return false;
        }

        try {
            this.socket = socketlib;
            this.socket.register('syncItem', this._handleSyncItem.bind(this));
            this._registerHooks();
            this._startCleanupInterval();
            return true;
        } catch (error) {
            console.error('[SyncManager] Initialization error:', error);
            return false;
        }
    }

    static _canHandleSync() {
        const activeGMs = game.users.filter(u => u.isGM && u.active);
        if (activeGMs.length > 0) {
            return game.user.id === activeGMs[0].id;
        }

        const activeUsers = game.users.filter(u => u.active);
        if (activeUsers.length > 0) {
            const highestRole = Math.max(...activeUsers.map(u => u.role));
            const highestUser = activeUsers.find(u => u.role === highestRole);
            return game.user.id === highestUser.id;
        }

        return false;
    }

    static _hasPermission(actor, userId) {
        const user = game.users.get(userId);
        return user && (user.isGM || actor.isOwner);
    }

    static _findGuardiansForLinkage(linkageName) {
        const linkageActor = game.actors.find(a => a.name === linkageName);
        if (!linkageActor) {
            console.log('[SyncManager] Linkage actor not found:', linkageName);
            return [];
        }

        console.log('[SyncManager] Searching through actors:', 
            game.actors.map(a => ({
                id: a.id,
                name: a.name,
                type: a.system?.props?.type,
                pilotname: a.system?.props?.pilotname
            }))
        );

        const guardians = game.actors.filter(a => 
            a.system?.props?.type === "guardian" &&
            a.system?.props?.pilotname === linkageName &&
            a.id !== linkageActor.id
        );

        console.log('[SyncManager] Found guardians for linkage:', {
            linkageName,
            guardianCount: guardians.length,
            guardians: guardians.map(g => ({
                id: g.id,
                name: g.name,
                type: g.system?.props?.type,
                pilotname: g.system?.props?.pilotname
            }))
        });

        return guardians;
    }

    static _findOtherGuardiansWithSamePilot(guardian) {
        const pilotName = guardian.system?.props?.pilotname;
        if (!pilotName) return [];

        const otherGuardians = game.actors.filter(a => 
            a.system?.props?.type === "guardian" &&
            a.system?.props?.pilotname === pilotName &&
            a.id !== guardian.id
        );

        console.log('[SyncManager] Found other guardians with same pilot:', {
            pilotName,
            guardianCount: otherGuardians.length,
            guardians: otherGuardians.map(g => g.name)
        });

        return otherGuardians;
    }

    static _isSyncableItem(item) {
        if (item?.system?.props?.type === 'specialty' || 
            item?.system?.props?.type === 'bless' || item?.system?.props?.type === 'class') {
            return true;
        }

        const hiddenType = item?.system?.hidden?.[0];
        if (hiddenType?.name === 'type' && 
            (hiddenType.value === 'specialty' || hiddenType.value === 'bless' || hiddenType.value === 'class')) {
            return true;
        }

        return false;
    }

    static async _handleSyncItem(data) {
        if (this.syncing || !this._canHandleSync()) return;
    
        try {
            this.syncing = true;
            const { itemData, targetActorId, sourceActorId, action } = data;
            
            console.log('[SyncManager] Handling sync:', {
                action,
                sourceActorId,
                targetActorId,
                itemName: itemData.name,
                timestamp: Date.now()
            });
    
            const syncKey = `${sourceActorId}-${itemData._id}-${targetActorId}-${action}`;
            if (this.processedUpdates.has(syncKey)) {
                console.log('[SyncManager] Update already processed:', syncKey);
                return;
            }
            
            this.processedUpdates.set(syncKey, Date.now());
    
            const targetActor = game.actors.get(targetActorId);
            if (!targetActor) {
                console.log('[SyncManager] Target actor not found:', targetActorId);
                return;
            }
    
            console.log('[SyncManager] Starting sync operation for:', targetActor.name);
    
            switch (action) {
                case 'create':
                    await this._createSyncedItem(targetActor, itemData);
                    break;
                case 'update':
                    await this._updateSyncedItem(targetActor, itemData);
                    break;
                case 'delete':
                    await this._deleteSyncedItem(targetActor, itemData);
                    break;
            }
    
            console.log('[SyncManager] Sync operation completed for:', targetActor.name);
    
        } catch (error) {
            console.error('[SyncManager] Sync error:', error);
        } finally {
            this.syncing = false;
        }
    }

    static async _createSyncedItem(actor, itemData) {
        const existingItem = actor.items.find(i => 
            i.flags?.['metalic-combat-system']?.originalItemId === itemData._id ||
            i.flags?.['metalic-combat-system']?.originalItemId === itemData.flags?.['metalic-combat-system']?.originalItemId
        );

        if (!existingItem) {
            const syncData = duplicate(itemData);
            if (!syncData.flags) syncData.flags = {};
            
            const originalItemId = itemData.flags?.['metalic-combat-system']?.originalItemId || itemData._id;
            syncData.flags['metalic-combat-system'] = {
                originalItemId: originalItemId,
                isSynced: true
            };

            try {
                await actor.createEmbeddedDocuments('Item', [syncData], {syncing: true});
            } catch (error) {
                console.error('Failed to create synced item:', error);
            }
        }
    }

    static async _updateSyncedItem(actor, itemData) {
        const existingItem = actor.items.find(i => 
            i.flags?.['metalic-combat-system']?.originalItemId === itemData._id ||
            i.flags?.['metalic-combat-system']?.originalItemId === itemData.flags?.['metalic-combat-system']?.originalItemId
        );

        if (existingItem) {
            const syncData = duplicate(itemData);
            syncData._id = existingItem.id;
            await existingItem.update(syncData, {syncing: true});
        }
    }

    static async _deleteSyncedItem(actor, itemData) {
        const existingItem = actor.items.find(i => 
            i.flags?.['metalic-combat-system']?.originalItemId === itemData._id ||
            i.flags?.['metalic-combat-system']?.originalItemId === itemData.flags?.['metalic-combat-system']?.originalItemId
        );

        if (existingItem) {
            await actor.deleteEmbeddedDocuments('Item', [existingItem.id], {syncing: true});
        }
    }

    static _registerHooks() {
        // 아이템 동기화 Hooks
        Hooks.on('createItem', async (item, options, userId) => {
            console.log('[SyncManager] Item created event triggered:', {
                itemName: item.name,
                actorName: item.actor?.name,
                actorType: item.actor?.system?.props?.type,
                pilotName: item.actor?.system?.props?.pilotname
            });
    
            if (this.syncing || options.syncing || !item.actor) return;
            if (!this._isSyncableItem(item)) return;
            if (!this._hasPermission(item.actor, userId)) return;
    
            const itemData = item.toObject();
                
            // 가디언일 경우 같은 파일럿을 가진 다른 가디언들과 동기화
            if (item.actor.system?.props?.type === "guardian") {
                const otherGuardians = this._findOtherGuardiansWithSamePilot(item.actor);
                for (const guardian of otherGuardians) {
                    console.log('[SyncManager] Syncing to guardian with same pilot:', {
                        fromGuardian: item.actor.name,
                        toGuardian: guardian.name
                    });
                    
                    await this.socket.executeForEveryone('syncItem', {
                        itemData,
                        sourceActorId: item.actor.id,
                        targetActorId: guardian.id,
                        action: 'create'
                    });
                }
            }
    
            // 해당 액터를 파일럿으로 가진 가디언들과 동기화
            const guardians = this._findGuardiansForLinkage(item.actor.name);
            console.log('[SyncManager] Syncing to all guardians:', {
                fromPilot: item.actor.name,
                guardians: guardians.map(g => g.name)
            });
    
            for (const guardian of guardians) {
                console.log('[SyncManager] Executing sync for guardian:', guardian.name);
                await this.socket.executeForEveryone('syncItem', {
                    itemData,
                    sourceActorId: item.actor.id,
                    targetActorId: guardian.id,
                    action: 'create'
                });
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });
    
        Hooks.on('updateItem', async (item, changes, options, userId) => {
            console.log('[SyncManager] Item update event triggered:', {
                itemName: item.name,
                actorName: item.actor?.name,
                actorType: item.actor?.system?.props?.type,
                pilotName: item.actor?.system?.props?.pilotname,
                changes: changes
            });
    
            if (this.syncing || options.syncing || !item.actor) return;
            if (!this._isSyncableItem(item)) return;
            if (!this._hasPermission(item.actor, userId)) return;
    
            const itemData = item.toObject();
    
            // 가디언일 경우 같은 파일럿을 가진 다른 가디언들과 동기화
            if (item.actor.system?.props?.type === "guardian") {
                const otherGuardians = this._findOtherGuardiansWithSamePilot(item.actor);
                console.log('[SyncManager] Updating other guardians with same pilot:', {
                    fromGuardian: item.actor.name,
                    otherGuardians: otherGuardians.map(g => g.name)
                });
    
                for (const guardian of otherGuardians) {
                    console.log('[SyncManager] Executing update for guardian:', guardian.name);
                    await this.socket.executeForEveryone('syncItem', {
                        itemData,
                        sourceActorId: item.actor.id,
                        targetActorId: guardian.id,
                        action: 'update'
                    });
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
    
            // 해당 액터를 파일럿으로 가진 가디언들과 동기화
            const guardians = this._findGuardiansForLinkage(item.actor.name);
            console.log('[SyncManager] Updating all guardians:', {
                fromPilot: item.actor.name,
                guardians: guardians.map(g => g.name)
            });
    
            for (const guardian of guardians) {
                console.log('[SyncManager] Executing update for guardian:', guardian.name);
                await this.socket.executeForEveryone('syncItem', {
                    itemData,
                    sourceActorId: item.actor.id,
                    targetActorId: guardian.id,
                    action: 'update'
                });
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });
    
        Hooks.on('deleteItem', async (item, options, userId) => {
            console.log('[SyncManager] Item delete event triggered:', {
                itemName: item.name,
                actorName: item.actor?.name,
                actorType: item.actor?.system?.props?.type,
                pilotName: item.actor?.system?.props?.pilotname
            });
    
            if (this.syncing || options.syncing || !item.actor) return;
            if (!this._isSyncableItem(item)) return;
            if (!this._hasPermission(item.actor, userId)) return;
    
            const itemData = item.toObject();
    
            // 가디언일 경우 같은 파일럿을 가진 다른 가디언들과 동기화
            if (item.actor.system?.props?.type === "guardian") {
                const otherGuardians = this._findOtherGuardiansWithSamePilot(item.actor);
                console.log('[SyncManager] Deleting from other guardians with same pilot:', {
                    fromGuardian: item.actor.name,
                    otherGuardians: otherGuardians.map(g => g.name)
                });
    
                for (const guardian of otherGuardians) {
                    console.log('[SyncManager] Executing delete for guardian:', guardian.name);
                    await this.socket.executeForEveryone('syncItem', {
                        itemData,
                        sourceActorId: item.actor.id,
                        targetActorId: guardian.id,
                        action: 'delete'
                    });
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
    
            // 해당 액터를 파일럿으로 가진 가디언들과 동기화
            const guardians = this._findGuardiansForLinkage(item.actor.name);
            console.log('[SyncManager] Deleting from all guardians:', {
                fromPilot: item.actor.name,
                guardians: guardians.map(g => g.name)
            });
    
            for (const guardian of guardians) {
                console.log('[SyncManager] Executing delete for guardian:', guardian.name);
                await this.socket.executeForEveryone('syncItem', {
                    itemData,
                    sourceActorId: item.actor.id,
                    targetActorId: guardian.id,
                    action: 'delete'
                });
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        });
    
        // Actor 속성 동기화 추가
        Hooks.on('updateActor', async (actor, changes, options, userId) => {
            if (this.syncing || options.syncing) return;
            if (!this._hasPermission(actor, userId)) return;
            
            const fieldsToSync = [
                'guardianlv', 'linkagelv1', 'linkagelv2', 
                'con', 'reflec', 'per', 'int', 'will', 'luck', 
                'specialty', 'atk', 'coninfut', 'reflecinfut',
                'perinfut', 'intinfut', 'willinfut', 'luckinfut',
                'atkinfut'
            ];
    
            // 변경된 필드 중 동기화가 필요한 것이 있는지 확인
            const updateData = {};
            let hasChanges = false;
    
            for (let field of fieldsToSync) {
                if (changes.system?.props?.[field] !== undefined) {
                    updateData[`system.props.${field}`] = changes.system.props[field];
                    hasChanges = true;
                }
            }
    
            if (!hasChanges) return;
    
            // 가디언일 경우 다른 가디언들과 동기화
            if (actor.system?.props?.type === "guardian") {
                const otherGuardians = this._findOtherGuardiansWithSamePilot(actor);
                for (const guardian of otherGuardians) {
                    try {
                        await guardian.update(updateData, {syncing: true});
                    } catch (error) {
                        console.error('[SyncManager] Failed to sync actor fields to guardian:', error);
                    }
                }
            }
    
            // 파일럿일 경우 연결된 가디언들과 동기화
            const guardians = this._findGuardiansForLinkage(actor.name);
            for (const guardian of guardians) {
                try {
                    await guardian.update(updateData, {syncing: true});
                } catch (error) {
                    console.error('[SyncManager] Failed to sync actor fields to guardian:', error);
                }
            }
        });
    }

    static _startCleanupInterval() {
        setInterval(() => {
            const fiveMinutesAgo = Date.now() - 300000;
            for (const [updateId, timestamp] of this.processedUpdates.entries()) {
                if (timestamp < fiveMinutesAgo) {
                    this.processedUpdates.delete(updateId);
                }
            }
        }, 300000);
    }
}