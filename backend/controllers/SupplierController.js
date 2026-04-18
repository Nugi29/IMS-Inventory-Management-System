const { models } = require('../config/db');

const { supplier: Supplier, supplier_status: SupplierStatus } = models;

const supplierStatusInclude = {
    model: SupplierStatus,
    as: 'supplier_status',
    attributes: ['id', 'name'],
};

//create Supplier
const createSupplier = async (req, res) => {
    const { name, phone, email, address } = req.body;   
    try {
        if (!name) {
            return res.status(400).json({ success: false, message: 'Name is required' });
        }
        const newSupplier = await Supplier.create({ name, phone, email, address, supplier_status_id: 1 });
        const supplier = await Supplier.findByPk(newSupplier.id, { include: [supplierStatusInclude] });
        return res.status(201).json({ success: true, supplier, message: 'Supplier created successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to create supplier' });
    }
};

//Get all suppliers
const getAllSuppliers = async (req, res) => {
    try {
        const suppliers = await Supplier.findAll({
            include: [supplierStatusInclude],
        });
        return res.status(200).json({ success: true, suppliers });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch suppliers' });
    }
};

//Get supplier by id
const getSupplierById = async (req, res) => {
    const { id } = req.params;
    try {
        const supplier = await Supplier.findByPk(id, {
            include: [supplierStatusInclude],
        });
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }
        return res.status(200).json({ success: true, supplier });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch supplier' });
    }
};

//Get supplier by name
const getSupplierByName = async (req, res) => {
    const name = (req.params && req.params.name) || (req.query && req.query.name);
    if (!name) {
        return res.status(400).json({ success: false, message: 'Name is required' });
    }
    try {
        const suppliers = await Supplier.findAll({
            where: { name },
            include: [supplierStatusInclude],
        });
        if (suppliers.length === 0) {
            return res.status(404).json({ success: false, message: 'No suppliers found with the given name' });
        }
        return res.status(200).json({ success: true, suppliers });
    }catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to fetch suppliers' });
    }   
};

//Update supplier
const updateSupplier = async (req, res) => {
    const { id } = req.params;
    const { name, phone, email, address, supplier_status_id } = req.body;
    try {
        const supplier = await Supplier.findByPk(id);
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }
        await supplier.update({
            name,
            phone,
            email,
            address,
            supplier_status_id: supplier_status_id !== undefined ? Number(supplier_status_id) : supplier.supplier_status_id,
        });
        const updatedSupplier = await Supplier.findByPk(id, {
            include: [supplierStatusInclude],
        });
        return res.status(200).json({ success: true, supplier: updatedSupplier, message: 'Supplier updated successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to update supplier' });
    }
};

//Delete supplier
const deleteSupplier = async (req, res) => {
    const { id } = req.params;
    try {
        const supplier = await Supplier.findByPk(id);
        if (!supplier) {
            return res.status(404).json({ success: false, message: 'Supplier not found' });
        }
        await supplier.destroy();
        return res.status(200).json({ success: true, message: 'Supplier deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to delete supplier' });
    }
};

module.exports = {
    createSupplier,
    getAllSuppliers,
    getSupplierById,
    getSupplierByName,
    updateSupplier,
    deleteSupplier
};
