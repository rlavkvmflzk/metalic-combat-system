export class DiceHelper {
    static safeParseInt(value, defaultValue = 0) {
        const parsed = parseInt(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    static async roll(formula) {
        const roll = new Roll(formula);
        try {
            await roll.evaluate({ async: true });
            return roll;
        } catch (error) {
            console.error('Error evaluating roll:', error);
            throw error;
        }
    }
}