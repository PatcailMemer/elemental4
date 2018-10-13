// Handles raw elements, getting, setting
// with the database
import { IElement, IElementNoId, Stats, ICombo, ISuggestionRequest, ISuggestion } from '../shared/api-1-types';
import { elementNameToStorageID, delay } from '../shared/shared';
import { connect, table, row, Connection, db } from 'rethinkdb';
import { RETHINK_LOGIN, ENABLE_DATABASE } from './constants';
import * as log from './logger';
import { pathExists, unlink, writeFile, readFile } from 'fs-extra';
import { webhookOnComboCreate } from './webhook';

let conn: Connection = null;
export let databaseConnected = false;

async function waitUntilDBReconnect() {
    if (!ENABLE_DATABASE) return;
    while(!databaseConnected) {
        try {
            await tryConnect();
        } catch {
            // wait some time (20 seconds)
            await delay(20000);
        }
    }
}

async function tryConnect() {
    if (!ENABLE_DATABASE) return;
    databaseConnected = false;
    conn = await connect(RETHINK_LOGIN);
    conn.on("close", () => {
        if(!databaseConnected) return;
        databaseConnected = false;
        log.error("Rethink Connection Lost");
        waitUntilDBReconnect();
    });
    conn.on("error", (e) => {
        if(!databaseConnected) return;
        log.error("Database Error: " + e);
    });
    databaseConnected = true;
    log.info("Rethink Connection Created.");
    await generateDatabase();
}

export async function initDatabase() {
    if (!ENABLE_DATABASE) return;
    try {
        await tryConnect();
    } catch {
        log.error("Rethink Connection Failed, is the database down?");
        waitUntilDBReconnect();
    }
}

let addingElement = false;
export async function writeElement(elem: IElementNoId) {
    // we cant have two of these operations at the same time, so at the start we check
    // if one is happening, then we just wait until the other one finishes.
    while (addingElement) {
        await delay(1000); 
    }
    addingElement = true;
    
    const next = (await readFile(".localsave")).toString().split("=")[1];
    log.db("Adding Element #" + next + ": " + elem.display);
    (elem as IElement).id = next;
    await writeFile(".localsave", "next-elem=" + (parseInt(next) + 1));
    await table('elements').insert([elem]).run(conn);
    
    addingElement = false;
}

export async function writeCombo(elem: ICombo) {
    const out = await table('combos').insert([elem]).run(conn);
    return out.generated_keys[0];
}

export async function getElementData(id: string): Promise<IElement | undefined> {
    const res = await table('elements').filter(row('id').eq(id)).coerceTo("array").run(conn)
    return res[0];
}

export async function getComboData(id1: string, id2: string): Promise<ICombo> {
    const res = await table('combos').filter(row('recipe').eq(id1+"+"+id2)).coerceTo("array").run(conn)
    return res[0];
}

export async function getGameStats(): Promise<Stats> {
    return {
        version: '0.1.1',
        version_id: 1,
        total_elements: await table("elements").count().run(conn)
    }
}

export async function suggestElement(recipe: string, suggest: ISuggestionRequest, voter: string) {
    const count = await table('suggestions').filter(row('recipe').eq(recipe)).count().run(conn);
    if(count === 0) {
        // Add a complete new suggestion.
        await table('suggestions').insert([{
            recipe,
            results: [
                {
                    name: elementNameToStorageID(suggest.display),
                    totalVotes: 1,
                    variants: [
                        {
                            color: suggest.color,
                            display: suggest.display,
                            downvotes: [],
                            votes: [voter]
                        }
                    ]
                }
            ]
        } as ISuggestion]).run(conn);
    } else {
        const res = (await table('suggestions').filter(row('recipe').eq(recipe)).coerceTo("array").run(conn))[0] as ISuggestion;
        const name = elementNameToStorageID(suggest.display);
        let find_name = res.results.find(x => x.name === name);
        if(!find_name) {
            res.results.push({
                name,
                totalVotes: 1,
                variants: [
                    {
                        color: suggest.color,
                        display: suggest.display,
                        downvotes: [],
                        votes: [voter]
                    }
                ]
            });
        } else {
            // ignoring vote
            if (find_name.variants.find( vari => !!vari.votes.find(vote => vote === voter))) {
                log.debug("ignoring dupelicate vote");
                return false;
            }
            let find_vari = find_name.variants.find(x => x.display === suggest.display && x.color === suggest.color);
            find_name.totalVotes++;
            if (find_vari) {
                find_vari.votes.push(voter);
                find_name.variants.forEach((x, ind) => {
                    if (x.display === suggest.display && x.color === suggest.color) {
                        find_name.variants[ind] = find_vari;
                    }
                });
            } else {
                find_name.variants.push({
                    color: suggest.color,
                    display: suggest.display,
                    downvotes: [],
                    votes: [voter]
                });
            }
            res.results.forEach((x, ind) => {
                if (x.name === name) {
                    res.results[ind] = find_name;
                }
            });
        }
        await table('suggestions').filter(row('recipe').eq(recipe)).replace(res).run(conn);
    }
}

export async function getComboSuggestions(id1: string, id2: string): Promise<ISuggestion> {
    const res = await table('suggestions').filter(row('recipe').eq(id1 + "+" + id2)).limit(1).run(conn)
    const arr = await res.toArray();
    return arr[0];
}

export async function generateDatabase() {    
    // ts definitions break on the following line
    if (await (db(RETHINK_LOGIN.db).tableList() as any).contains("elements").run(conn)) {
        return;
    }
    log.db("--Creating Database--");
    
    // Write the next elemenet file
    log.db("Writing Local Save");
    
    await writeFile(".localsave", "next-elem=1");
    
    // Write Tables
    log.db("Adding Table `elements`");
    await db(RETHINK_LOGIN.db).tableCreate("elements").run(conn);
    log.db("Adding Table `combos`");
    await db(RETHINK_LOGIN.db).tableCreate("combos").run(conn);
    log.db("Adding Table `suggestions`");
    await db(RETHINK_LOGIN.db).tableCreate("suggestions").run(conn);
    
    // Write Elements
    await writeElement({
        color: "sky",
        display: "Air"
    });
    await writeElement({
        color: "brown",
        display: "Earth"
    });
    await writeElement({
        color: "orange",
        display: "Fire"
    });
    await writeElement({
        color: "blue",
        display: "Water"
    });
    log.db("--Creating Database Done--");
}