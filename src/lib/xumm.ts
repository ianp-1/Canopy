import { Xumm } from 'xumm'

let xummInstance: Xumm | null = null

export const getXumm = () => {
    if (xummInstance) return xummInstance

    if (!process.env.XUMM_API_KEY || !process.env.XUMM_API_SECRET) {
        throw new Error('XUMM_API_KEY and XUMM_API_SECRET must be defined in environment variables')
    }

    xummInstance = new Xumm(
        process.env.XUMM_API_KEY,
        process.env.XUMM_API_SECRET
    )

    return xummInstance
}
