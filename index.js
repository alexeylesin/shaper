require("dotenv-flow").config();
const con = require("mysql").createPool(
    require("./database.json")
);

function randomStr(length = 6) {
    var result = "";
    var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }

    return result;
}

const uuid = require("uuid");
const fetch = require("node-fetch");
function createLink(
    client_id = process.env.CLIENT_ID, redirect_uri = process.env.CALLBACK_URI,
    response_type = "code", scope = "identify"
) { return encodeURI(`https://discord.com/api/oauth2/authorize?client_id=${client_id}&redirect_uri=${redirect_uri}&response_type=${response_type}&scope=${scope}`); }

const express = require("express");
const app = express();

app.use("/static", express.static("static"));
app.set("view engine", "ejs");

app.use(require("cookie-parser")());
app.use(require("helmet")());

app.get("/", (req, res) => res.redirect("/me"));
app.get("/auth", (req, res) => {
    return con.query("SELECT id, isActivated FROM users WHERE cookie_token = ?", [req.cookies.linkshaper], (err, data) => {
        if(err) throw err;
        fetch("https://discordapp.com/api/users/@me", {
            headers: { "Authorization": req.cookies.linkshaper }
        }).then(rr => rr.json()).then(rr =>
            res.render("index", {
                data: (data[0]) ? data[0] : null, discord: rr,
                code: (req.query.code) ? req.query.code : null,
                error: (req.query.error) ? req.query.error : null,
            })
        ).catch(console.error);
    });
});

app.get("/auth/login", (req, res) => {
    if(req.cookies.linkshaper) return res.redirect("/auth");
    return res.redirect(createLink());
});

app.get("/auth/callback", (req, res) => {
    if(req.cookies.linkshaper) return res.redirect("/auth");
    return fetch("https://discordapp.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.CLIENT_ID,
            client_secret: process.env.CLIENT_SECRET,
            redirect_uri: process.env.CALLBACK_URI,
            grant_type: "authorization_code",
            scope: "identify", code: req.query.code
        })
    }).then(r => r.json()).then(r => {
        if(!r.token_type || !r.access_token) return res.redirect(encodeURI("/auth?error=Try again, please!"));
        const token = `${r.token_type} ${r.access_token}`;
        fetch("https://discordapp.com/api/users/@me", {
            headers: { "Authorization": token }
        }).then(rr => rr.json()).then(rr => {
            if(!rr.id) return res.redirect(encodeURI("/auth?error=Try again, please!"));
            return con.query("SELECT id FROM users WHERE id = ?", [rr.id], (err, data) => {
                if(err) throw err;
                if(!data[0]) return con.query("INSERT INTO users (id, cookie_token, ip) VALUES (?, ?, ?)", [rr.id, token, req.headers["x-forwarded-for"]], (err) => {
                    if(err) throw err;
                    res.cookie("linkshaper", token, { maxAge: 604800000 });
                    
                    return res.redirect("/auth");
                }); else return con.query("UPDATE users SET cookie_token = ?, ip = ? WHERE id = ?", [token, req.headers["x-forwarded-for"], rr.id], (err) => {
                    if(err) throw err;
                    res.cookie("linkshaper", token, { maxAge: 604800000 });
                    
                    return res.redirect("/auth");
                });
            });
        }).catch(console.error);
    }).catch(console.error);
});

app.get("/auth/logout", (req, res) => {
    res.cookie("linkshaper", null, { maxAge: -1 });
    return res.redirect("/auth");
});

app.get("/api", (req, res) => {
    return con.query("SELECT id, isActivated, access_token FROM users WHERE cookie_token = ?", [req.cookies.linkshaper], (err, data) => {
        if(err) throw err;
        if(!data[0]) return res.redirect("/auth/logout");
        if(!data[0].access_token) {
            data[0].access_token = uuid.v4();
            con.query("UPDATE users SET access_token = ? WHERE cookie_token = ?", [data[0].access_token, req.cookies.linkshaper], (err, data) => {
                if(err) throw err;
            });
        }

        return res.render("api", { data: (data[0]) ? data[0] : null });
    });
});

app.get("/api/create", (req, res) => {
    let sql;
    if(!req.query.access_token) sql = "SELECT id, isActivated FROM users WHERE cookie_token = ?";
    else sql = "SELECT id, isActivated FROM users WHERE access_token = ?";

    return con.query(sql, [(sql.includes("access_token")) ? req.query.access_token : req.cookies.linkshaper], (err, users) => {
        if(err) throw err;
        if(!users[0] || (users[0] && Boolean(users[0].isActivated) == false)) {
            if(sql.includes("access_token")) return res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
            else return res.redirect(encodeURI(`/auth?error=Unauthorized`));
        }
        
        let { link, code } = req.query;
        if(!link) {
            if(sql.includes("access_token")) return res.status(406).json({ error: { code: 406, message: "Not Acceptable" } });
            else return res.redirect(encodeURI(`/auth?error=Not Acceptable`));
        }
        
        let checkingCode;
        if(!code) checkingCode = randomStr();
        else checkingCode = code;

        return con.query("SELECT id FROM links WHERE code = ?", [code], (err, data) => {
            if(err) throw err;
            if(data[0]) {
                if(sql.includes("access_token")) return res.status(449).json({ error: { code: 449, message: "Retry with new code!" } });
                else return res.redirect(encodeURI(`/auth?error=Retry with new code!`));
            }

            return con.query("INSERT INTO links (code, link, owner) VALUES (?, ?, ?)", [checkingCode, link, users[0].id], (err) => {
                if(err) throw err;
                if(sql.includes("access_token")) return res.status(201).json({ created: true });
                else return res.redirect(`/auth?code=${checkingCode}`);
            });
        });
    });
});

app.get("/api/code", (req, res) => {
    return con.query("SELECT id, isActivated FROM users WHERE access_token = ?", [req.query.access_token], (err, users) => {
        if(err) throw err;
        if(!users[0] || (users[0] && Boolean(users[0].isActivated) == false))
            return res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
        
        if(!req.query.code)
            return res.status(406).json({ error: { code: 406, message: "Not Acceptable" } });

        return con.query("SELECT * FROM links WHERE code = ?", [req.query.code], (err, data) => {
            if(err) throw err;
            if(!data[0])
                return res.status(404).json({ error: { code: 404, message: "Not Found" } });

            data[0].isDeletable = Boolean(data[0].isDeletable);
            return res.status(202).json(data[0]);
        });
    });
});

app.get("/api/codes", (req, res) => {
    return con.query("SELECT id, isActivated FROM users WHERE access_token = ?", [req.query.access_token], (err, users) => {
        if(err) throw err;
        if(!users[0] || (users[0] && Boolean(users[0].isActivated) == false))
            return res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
        
        if(!req.query.id) req.query.id = users[0].id;
        return con.query("SELECT * FROM links WHERE owner = ?", [req.query.id], (err, data) => {
            if(err) throw err;
            
            data.map(r => r.isDeletable = Boolean(r.isDeletable));
            return res.status(202).json(data);
        });
    });
});

app.get("/api/delete", (req, res) => {
    return con.query("SELECT id, isActivated FROM users WHERE access_token = ?", [req.query.access_token], (err, users) => {
        if(err) throw err;
        if(!users[0] || (users[0] && Boolean(users[0].isActivated) == false))
            return res.status(401).json({ error: { code: 401, message: "Unauthorized" } });
        
        if(!req.query.code)
            return res.status(406).json({ error: { code: 406, message: "Not Acceptable" } });

        return con.query("SELECT * FROM links WHERE code = ?", [req.query.code], (err, data) => {
            if(err) throw err;
            if(!data[0])
                return res.status(404).json({ error: { code: 404, message: "Not Found" } });

            if(data[0].owner !== users[0].id)
                return res.status(401).json({ error: { code: 401, message: "Unauthorized (you haven't own this code)" } });

            if(Boolean(data[0].isDeletable) == false)
                return res.status(423).json({ error: { code: 423, message: "Locked" } });

            return con.query("DELETE FROM links WHERE id = ?", [data[0].id], (err) => {
                if(err) throw err;

                data[0].isDeletable = Boolean(data[0].isDeletable);
                return res.status(410).json({ deleted: true, data: data[0] });
            });
        });
    });
});

app.get("/:code", (req, res) => {
    return con.query("SELECT id, clicks, link FROM links WHERE code = ?", [req.params.code], (err, data) => {
        if(err) throw err;
        if(!data[0]) return res.status(404).render("_error", { error: { code: 404, message: "Not Found" } });
        
        return con.query("UPDATE links SET clicks = ? WHERE id = ?", [data[0].clicks + 1, data[0].id], (err) => {
            if(err) throw err;
            return res.redirect(data[0].link);
        });
    });
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    return res.status(500).render("_error", { error: { code: 500, message: "Internal Server Error" } });
});

app.listen(process.env.PORT || 3000, () => console.info(`* Listening on *:${process.env.PORT || 3000}...`));