// Directly sampled from Construct by ForestOfLight, MIT license (notice included).
// Original: classes/Materials/StructureMaterials.js, static subtractInventory.
// The original method is preserved below verbatim, wrapped in a standalone class
// so Genesis can call it without importing Construct's unrelated UI and GameTest dependencies.
export class StructureMaterials {
    static subtractInventory(materials, container) {
        const remaining = {};
        for (const [typeId, entry] of Object.entries(materials))
            remaining[typeId] = { count: entry.count, stackSize: entry.stackSize };
        for (let slotIndex = 0; slotIndex < container.size; slotIndex++) {
            const slot = container.getSlot(slotIndex);
            if (!slot.hasItem())
                continue;
            const entry = remaining[slot.typeId];
            if (!entry)
                continue;
            entry.count -= slot.amount;
            if (entry.count <= 0)
                delete remaining[slot.typeId];
        }
        return remaining;
    }
}
