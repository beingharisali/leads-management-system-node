const express = require('express');
const router = express.Router();

const {
    firstAdminSignup,
    register,
    login,
    updateUser,
    updateStatus,
    getAllCSRs, // ✅ Sab CSRs ko dekhne ke liye
    getSingleUser // ✅ Profile check karne ke liye
} = require('../controllers/auth');

// Middleware: 'auth' for login check, 'authorizeRoles' for Admin-only access
const { auth, authorizeRoles } = require('../middleware/authentication');
const asyncWrapper = require('../middleware/async');

// ================= PUBLIC ROUTES =================
router.post('/login', asyncWrapper(login));
router.post('/first-admin-signup', asyncWrapper(firstAdminSignup));

// ================= PROTECTED ROUTES (All Logged-in Users) =================
router.get('/me', auth, asyncWrapper(getSingleUser));
router.put('/updateUser', auth, asyncWrapper(updateUser));

// ================= ADMIN ONLY ROUTES =================
// Note: authorizeRoles('admin') lagana lazmi hai taake CSRs register na kar saken
router.post('/register',
    auth,
    authorizeRoles('admin'),
    asyncWrapper(register)
);

router.get('/team-members',
    auth,
    authorizeRoles('admin'),
    asyncWrapper(getAllCSRs)
);

router.patch('/update-status/:id',
    auth,
    authorizeRoles('admin'),
    asyncWrapper(updateStatus)
);

module.exports = router;