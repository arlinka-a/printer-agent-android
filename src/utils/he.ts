export const ltr = (text: string | number) => `⁦${text}⁩`;

export const timeStamp = () => new Date().toLocaleTimeString('he-IL', { hour12: false });