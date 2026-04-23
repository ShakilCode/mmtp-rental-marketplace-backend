export function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {

        // check user
        if (!req.user) {
            return res.status(401).json({
                message: "Unauthorized - No user found"
            })
        }

        // check role
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Access denied"
            })
        }

        next()
    }
}