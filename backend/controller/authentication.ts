import { Request } from 'express'

export async function expressAuthentication(
    req: Request,
    securityName: string,
    scopes?: string[]
): Promise<any> {
    if (securityName === 'cookieAuth') {
        if (req.isAuthenticated()) {
            return req.user
        } else {
            throw new Error('alerts.request.unauthorized')
        }
    }
}