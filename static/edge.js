window.onload = () => {
    let allCodes = $("#allCodes");
    $.ajax({
        url: "/api/codes",
        dataType: "json",
        async success(r) {
            await r.map(data => allCodes.append(`<tr id="code-${data.code}"><th>${data.code}</th><td>${data.link}</td><td>${data.clicks}</td><td>${(Boolean(data.isDeletable == true)) ? "<span class='delete-code' style='color: gold; cursor: pointer' data-id='" + data.code + "'>&times;</span>" : "<span style='color: red'>Locked</span>"}</td></tr>`));
            for (const deleteButton of $(".delete-code")) {
                deleteButton.onclick = (t) => {
                    let code = t.target.attributes[2].value;
                    let test = confirm("Are you ok? You really want do this?");
                    if(test == true) {
                        $.ajax({
                            url: `/api/delete?code=${code}`,
                            dataType: "json",
                            error(e) {
                                if(e.status !== 410) return console.error(e.stack);
                                else return $(`#code-${code}`)[0].remove();
                            }
                        });
                    } else return;
                };
            }
        },
        error(e) { console.error(e.stack); }
    });
}