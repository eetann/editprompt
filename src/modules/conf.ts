import Conf from "conf";

const projectName = process.env.NODE_ENV === "test" ? "editprompt-test" : "editprompt";

export const conf = new Conf({ projectName });
