const express = require('express');
const router = express.Router();

const {
    firstAdminSignup,
    register,
    login,
    updateUser,
    updateStatus,
    getAllCSRs,
    getSingleUser
} = require('../controllers/auth');

// Middleware: 'auth' for token verification, 'authorizeRoles' for Admin-only access
const { auth, authorizeRoles } = require('../middleware/authentication');
const asyncWrapper = require('../middleware/async');

// ================= PUBLIC ROUTES =================
// Public endpoints for authentication
router.post('/login', asyncWrapper(login));
router.post('/first-admin-signup', asyncWrapper(firstAdminSignup));

// ================= PROTECTED ROUTES (All Logged-in Users) =================
// Accessible by both Admin and CSR
router.get('/me', auth, asyncWrapper(getSingleUser));
router.patch('/updateUser', auth, asyncWrapper(updateUser)); // Changed to PATCH for partial updates
router.put('/updateUser', auth, asyncWrapper(updateUser));   // Kept PUT for compatibility

// ================= ADMIN ONLY ROUTES =================
/**
 * CSR MANAGEMENT
 * Restricted to users with 'admin' role only
 */

// 1. Create new CSR Account
router.post('/register',
    auth,
    authorizeRoles('admin'),
    asyncWrapper(register)
);

// 2. Fetch all CSRs for Dashboard stats/sidebar
router.get('/team-members',
    auth,
    authorizeRoles('admin'),
    asyncWrapper(getAllCSRs)
);

// 3. Toggle CSR Status (Active/Inactive)
// frontend se http.patch(`/auth/update-status/${id}`) call hoga
router.patch('/update-status/:id',
    auth,
    authorizeRoles('admin'),
    asyncWrapper(updateStatus)
);

// Helper route for status check in case PATCH is blocked
router.put('/update-status/:id',
    auth,
    authorizeRoles('admin'),
    asyncWrapper(updateStatus)
);

module.exports = router;