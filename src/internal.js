// GRID INTERNAL FIELDS
// ====================

var namespace = ".rs.jquery.bootgrid";

// GRID INTERNAL FUNCTIONS
// =====================

function getParams(context)
{
    var staticParams = {
        tpl: this.options.templates,
        lbl: this.options.labels,
        css: this.options.css,
        ctx: {}
    };
    return $.extend({}, staticParams, { ctx: context || {} });
}

function getRequest()
{
    var request = {
            current: this.current,
            rowCount: this.rowCount,
            sort: this.sort
        },
        post = this.options.post;

    post = ($.isFunction(post)) ? post() : post;
    return $.extend(true, request, post);
}

function getCssSelector(css)
{
    return "." + $.trim(css).replace(/\s+/gm, ".");
}

function getUrl()
{
    var url = this.options.url;
    return ($.isFunction(url)) ? url() : url;
}

function init()
{
    this.element.trigger("initialize" + namespace);

    loadColumns.call(this);
    prepareTable.call(this);
    renderTableHeader.call(this);
    renderActions.call(this);
    loadData.call(this);

    this.element.trigger("initialized" + namespace);
}

function isVisible(column)
{
    return column.visible;
}

function loadColumns()
{
    var that = this,
        firstHeadRow = this.element.find("thead > tr").first(),
        sorted = false;

    firstHeadRow.children().each(function()
    {
        var $this = $(this),
            order = $this.data("order"),
            sortable = $this.data("sortable"),
            visible = $this.data("visible"),
            column = {
                id: $this.data("column-id"),
                text: $this.text(),
                formatter: that.options.formatters[$this.data("formatter")],
                order: (!sorted && (order === "asc" || order === "desc")) ? order : null,
                sortable: !(sortable === false || sortable === 0), // default: true
                visible: !(visible === false || visible === 0) // default: true
            };
        that.columns.push(column);
        if (column.order != null)
        {
            that.sort[column.id] = column.order;
        }

        // ensures that only the first order will be applied in case of multi sorting is disabled
        if (!that.options.multiSort && column.order !== null)
        {
            sorted = true;
        }
    });
}

/*
response = {
    current: 1,
    rowCount: 10,
    rows: [{}, {}],
    sort: [{ "columnId": "asc" }],
    total: 101
}
*/

function loadData()
{
    var that = this,
        request = getRequest.call(this),
        url = getUrl.call(this);

    if (url == null || typeof url !== "string" || url.length === 0)
    {
        throw new Error("Url setting must be a none empty string or a function that returns one.");
    }

    this.element.trigger("load" + namespace);
    showLoading.call(this);
    // todo: support static data (no ajax)
    $.post(url, request, function (response)
    {
        if (typeof (response) === "string")
        {
            response = $.parseJSON(response);
        }

        that.rows = response.rows;
        that.current = response.current;
        that.total = response.total;
        that.totalPages = Math.ceil(that.total / that.rowCount);

        renderRows.call(that);
        renderInfos.call(that);
        renderPagination.call(that);
        that.element.trigger("loaded" + namespace);
    }).fail(function()
    {
        // overrides loading mask
        renderNoResultsRow.call(that);
    });
}

function prepareTable()
{
    var tpl = this.options.templates;

    this.element.addClass(this.options.css.table);

    // checks whether there is an tbody element; otherwise creates one
    if (this.element.children("tbody").length === 0)
    {
        this.element.append(tpl.body);
    }

    if (this.options.navigation & 1)
    {
        this.header = $(tpl.header.resolve(getParams.call(this, { id: this.element._bgId() + "-header" })));
        this.element.before(this.header);
    }

    if (this.options.navigation & 2)
    {
        this.footer = $(tpl.footer.resolve(getParams.call(this, { id: this.element._bgId() + "-footer" })));
        this.element.after(this.footer);
    }
}

function renderActions()
{
    if (this.options.navigation !== 0)
    {
        var css = this.options.css,
            selector = getCssSelector(css.actions),
            headerActions = this.header.find(selector),
            footerActions = this.footer.find(selector);

        if ((headerActions.length + footerActions.length) > 0)
        {
            var that = this,
                tpl = this.options.templates,
                refresh = $(tpl.actionButton.resolve(getParams.call(this, 
                    { iconCss: css.iconRefresh, text: this.options.labels.refresh })))
                        .on("click" + namespace, function (e)
                        {
                            // todo: prevent multiple fast clicks (fast click detection)
                            e.stopPropagation();
                            that.current = 1;
                            loadData.call(that);
                        }),
                actions = $(tpl.actions.resolve(getParams.call(this))).append(refresh);

            // Row count selection
            renderRowCountSelection.call(this, actions);

            // Column selection
            renderColumnSelection.call(this, actions);

            replacePlaceHolder.call(this, headerActions, actions, 1);
            replacePlaceHolder.call(this, footerActions, actions, 2);
        }
    }
}

function renderColumnSelection(actions)
{
    var that = this,
        css = this.options.css,
        tpl = this.options.templates,
        icon = tpl.icon.resolve(getParams.call(this, { iconCss: css.iconColumns })),
        dropDown = $(tpl.actionDropDown.resolve(getParams.call(this, { content: icon }))),
        selector = getCssSelector(css.dropDownItemCheckbox);

    $.each(this.columns, function(i, column)
    {
        var item = $(tpl.actionDropDownCheckboxItem.resolve(getParams.call(that, 
            { name: column.id, label: column.text, checked: column.visible })))
                .on("click" + namespace, selector, function (e)
                {
                    e.stopPropagation();
                    column.visible = $(this).find("input").prop("checked");
                    renderTableHeader.call(that);
                    renderRows.call(that);
                });
        dropDown.find(getCssSelector(css.dropDownMenuItems)).append(item);
    });
    actions.append(dropDown);
}

function renderInfos()
{
    if (this.options.navigation !== 0)
    {
        var selector = getCssSelector(this.options.css.infos),
            headerInfos = this.header.find(selector),
            footerInfos = this.footer.find(selector);

        if ((headerInfos.length + footerInfos.length) > 0)
        {
            var end = (this.current * this.rowCount),
                infos = $(this.options.templates.infos.resolve(getParams.call(this, { 
                    end: (this.total === 0 || end === -1 || end > this.total) ? this.total : end, 
                    start: (this.total === 0) ? 0 : (end - this.rowCount + 1), 
                    total: this.total
                })));

            replacePlaceHolder.call(this, headerInfos, infos, 1);
            replacePlaceHolder.call(this, footerInfos, infos, 2);
        }
    }
}

function renderNoResultsRow()
{
    var tbody = this.element.children("tbody").first(),
        tpl = this.options.templates;

    tbody.html(tpl.noResults.resolve(getParams.call(this, { columns: this.columns.where(isVisible).length })));
}

function renderPagination()
{
    if (this.options.navigation !== 0)
    {
        var selector = getCssSelector(this.options.css.pagination),
            headerPagination = this.header.find(selector)._bgShowAria(this.rowCount !== -1),
            footerPagination = this.footer.find(selector)._bgShowAria(this.rowCount !== -1);

        if (this.rowCount !== -1 && (headerPagination.length + footerPagination.length) > 0)
        {
            var tpl = this.options.templates,
                current = this.current,
                totalPages = this.totalPages,
                pagination = $(tpl.pagination.resolve(getParams.call(this))),
                offsetRight = totalPages - current,
                offsetLeft = (this.options.padding - current) * -1,
                startWith = ((offsetRight >= this.options.padding) ?
                    Math.max(offsetLeft, 1) :
                    Math.max((offsetLeft - this.options.padding + offsetRight), 1)),
                maxCount = this.options.padding * 2 + 1,
                count = (totalPages >= maxCount) ? maxCount : totalPages;

            renderPaginationItem.call(this, pagination, "first", "&laquo;", "first")
                ._bgEnableAria(current > 1);
            renderPaginationItem.call(this, pagination, "prev", "&lt;", "prev")
                ._bgEnableAria(current > 1);

            for (var i = 0; i < count; i++)
            {
                var pos = i + startWith;
                renderPaginationItem.call(this, pagination, pos, pos, "page-" + pos)
                    ._bgEnableAria()._bgSelectAria(pos === current);
            }

            if (count === 0)
            {
                renderPaginationItem.call(this, pagination, 1, 1, "page-" + 1)
                    ._bgEnableAria(false)._bgSelectAria();
            }

            renderPaginationItem.call(this, pagination, "next", "&gt;", "next")
                ._bgEnableAria(totalPages > current);
            renderPaginationItem.call(this, pagination, "last", "&raquo;", "last")
                ._bgEnableAria(totalPages > current);

            replacePlaceHolder.call(this, headerPagination, pagination, 1);
            replacePlaceHolder.call(this, footerPagination, pagination, 2);
        }
    }
}

function renderPaginationItem(list, uri, text, markerCss)
{
    var that = this,
        tpl = this.options.templates,
        css = this.options.css,
        values = getParams.call(this, { css: markerCss, text: text, uri: "#" + uri }),
        item = $(tpl.paginationItem.resolve(values)).addClass(css)
            .on("click" + namespace, getCssSelector(css.paginationButton), function (e)
            {
                e.stopPropagation();

                var $this = $(this),
                    parent = $this.parent();
                if (!parent.hasClass("active") && !parent.hasClass("disabled"))
                {
                    var commandList = {
                        first: 1,
                        prev: that.current - 1,
                        next: that.current + 1,
                        last: that.totalPages
                    };
                    var command = $this.attr("href").substr(1);
                    that.current = commandList[command] || +command; // + converts string to int
                    loadData.call(that);
                }
                $this.trigger("blur");
            });

    list.append(item);
    return item;
}

function renderRowCountSelection(actions)
{
    var that = this,
        rowCountList = this.options.rowCount;

    function getText(value)
    {
        return (value === -1) ? that.options.labels.all : value;
    }

    if ($.isArray(rowCountList)) {
        var css = this.options.css,
            tpl = this.options.templates,
            dropDown = $(tpl.actionDropDown.resolve(getParams.call(this, { content: this.rowCount }))),
            menuSelector = getCssSelector(css.dropDownMenu),
            menuTextSelector = getCssSelector(css.dropDownMenuText),
            menuItemsSelector = getCssSelector(css.dropDownMenuItems),
            menuItemSelector = getCssSelector(css.dropDownItemButton);

        $.each(rowCountList, function(index, value)
        {
            var item = $(tpl.actionDropDownItem.resolve(getParams.call(that, 
                { text: getText(value), uri: "#" + value })))
                    ._bgSelectAria(value === that.rowCount)
                    .on("click" + namespace, menuItemSelector, function (e)
                    {
                        e.preventDefault();

                        var $this = $(this),
                            newRowCount = +$this.attr("href").substr(1);
                        if (newRowCount !== that.rowCount)
                        {
                            // todo: sophisticated solution needed for calculating which page is selected
                            that.current = 1; // that.rowCount === -1 ---> All
                            that.rowCount = newRowCount;
                            $this.parents(menuItemsSelector).children().each(function()
                            {
                                var $item = $(this),
                                    currentRowCount = +$item.find(menuItemSelector).attr("href").substr(1);
                                $item._bgSelectAria(currentRowCount === newRowCount);
                            });
                            $this.parents(menuSelector).find(menuTextSelector).text(getText(newRowCount));
                            loadData.call(that);
                        }
                    });
            dropDown.find(menuItemsSelector).append(item);
        });
        actions.append(dropDown);
    }
}

function renderRows()
{
    if (this.rows.length > 0)
    {
        var that = this,
            tpl = this.options.templates,
            tbody = this.element.children("tbody").first(),
            html = "",
            cells = "";

        $.each(this.rows, function(i, row)
        {
            cells = "";

            $.each(that.columns, function(j, column)
            {
                if (column.visible)
                {
                    var value = ($.isFunction(column.formatter)) ? 
                        column.formatter.call(that, column, row) : row[column.id];
                    cells += tpl.cell.resolve(getParams.call(that, { content: 
                        (value == null || value === "") ? "&nbsp;" : value }));
                }
            });

            html += tpl.row.resolve(getParams.call(that, { cells: cells }));
        });

        tbody.html(html);
    }
    else
    {
        renderNoResultsRow.call(this);
    }
}

function renderTableHeader()
{
    var that = this,
        headerRow = this.element.find("thead > tr"),
        css = this.options.css,
        tpl = this.options.templates,
        html = "",
        sorting = this.options.sorting;

    $.each(this.columns, function(index, column)
    {
        if (column.visible)
        {
            var sortOrder = that.sort[column.id],
                iconCss = ((sorting && sortOrder && sortOrder === "asc") ? css.iconUp : 
                    (sorting && sortOrder && sortOrder === "desc") ? css.iconDown : ""),
                icon = tpl.icon.resolve(getParams.call(that, { iconCss: iconCss }));
            html += tpl.headerCell.resolve(getParams.call(that, 
                { content: column.text, icon: icon, columnId: column.id,
                    sortable: (sorting && column.sortable) ? css.sortable : "" }));
        }
    });

    headerRow.html(html);
    if (sorting)
    {
        headerRow.off("click" + namespace)
            .on("click" + namespace, getCssSelector(css.sortable), function(e)
            {
                e.preventDefault();
                var $this = $(this),
                    columnId = $this.data("column-id") || $this.parents("th").first().data("column-id"),
                    sortOrder = that.sort[columnId],
                    icon = $this.find(getCssSelector(css.icon));

                if (!that.options.multiSort)
                {
                    $this.parents("tr").first().find(getCssSelector(css.icon)).removeClass(css.iconDown + " " + css.iconUp);
                    that.sort = {};
                }

                if (sortOrder && sortOrder === "asc")
                {
                    that.sort[columnId] = "desc";
                    icon.removeClass(css.iconUp).addClass(css.iconDown);
                }
                else if (sortOrder && sortOrder === "desc")
                {
                    if (that.options.multiSort)
                    {
                        delete that.sort[columnId];
                        icon.removeClass(css.iconDown);
                    }
                    else
                    {
                        that.sort[columnId] = "asc";
                        icon.removeClass(css.iconDown).addClass(css.iconUp);
                    }
                }
                else
                {
                    that.sort[columnId] = "asc";
                    icon.addClass(css.iconUp);
                }

                loadData.call(that);
            });
    }
}

function replacePlaceHolder(placeholder, element, flag)
{
    if (this.options.navigation & flag)
    {
        placeholder.each(function(index, item)
        {
            // todo: check how append is implemented. Perhaps cloning here is superfluous.
            $(item).before(element.clone(true)).remove();
        });
    }
}

function showLoading()
{
    var tpl = this.options.templates,
        tbody = this.element.children("tbody").first(),
        firstCell = tbody.find("tr > td").first(),
        padding = Math.ceil((tbody.height() || 0) - (firstCell.height() + 20));

    tbody.html(tpl.loading.resolve(getParams.call(this, { columns: this.columns.where(isVisible).length })));
    if (this.rowCount !== -1 && padding > 0)
    {
        tbody.find("tr > td").css("padding", "20px 0 " + padding + "px");
    }
}