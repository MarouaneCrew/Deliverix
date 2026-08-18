const num = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const LOGIN_THROTTLE = {
    default: { limit: num(process.env.LOGIN_THROTTLE_LIMIT, 5), ttl: 60000 },
};

export const FORGOT_PASSWORD_THROTTLE = {
    default: { limit: num(process.env.FORGOT_PASSWORD_THROTTLE_LIMIT, 5), ttl: 60000 },
};

export const GLOBAL_THROTTLE_LIMIT = num(process.env.THROTTLE_GLOBAL_LIMIT, 20);