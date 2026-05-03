/**
 * Automatically syncs an item's status based on its new stock quantity.
 *
 * Rules:
 *  - If quantity reaches 0 AND status is Active (1)  → set to Out of Stock (4)
 *  - If quantity goes above 0 AND status is Out of Stock (4) → restore to Active (1)
 *  - Inactive (2) and Discontinued (3) are admin-controlled — never auto-changed here.
 *
 * @param {object} itemData   - Sequelize item instance (already updated quantity, not yet saved)
 * @param {object} [options]  - { transaction }
 */
const ITEM_STATUS = {
    ACTIVE: 1,
    INACTIVE: 2,
    DISCONTINUED: 3,
    OUT_OF_STOCK: 4,
};

const syncItemStatusByQuantity = async (itemData, options = {}) => {
    const currentStatusId = Number(itemData.item_status_id);
    const newQuantity = Number(itemData.quantity);

    // Only auto-manage Active <-> Out of Stock transitions
    if (newQuantity <= 0 && currentStatusId === ITEM_STATUS.ACTIVE) {
        itemData.item_status_id = ITEM_STATUS.OUT_OF_STOCK;
        await itemData.save(options);
        return;
    }

    if (newQuantity > 0 && currentStatusId === ITEM_STATUS.OUT_OF_STOCK) {
        itemData.item_status_id = ITEM_STATUS.ACTIVE;
        await itemData.save(options);
    }
};

module.exports = { syncItemStatusByQuantity, ITEM_STATUS };
