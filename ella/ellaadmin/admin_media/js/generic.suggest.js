/* TODO:
 * neukazovat vybrané hodnoty v lupičce,
 */
(function($) { $( function() {
    ;;; DEBUG = true;
    ;;; DBG = 1;
    var DEL_IMG = ADMIN_MEDIA_URL + 'img/admin/icon_deletelink.gif';
    var MIN_LENGTH = 2;
    var SUGGEST_FIELD_SEPARATOR = '|';
    var SUGGEST_RECORD_SEPARATOR = "\n";
    var URL_VAR_SEPARATOR = '&';
    var URL_FIELD_DENOTER = 'f';
    var SUGGEST_SELECTOR = '.GenericSuggestField,.GenericSuggestFieldMultiple';

    var CR = 13;
    var LF = 10;
    var ESC = 27;
    var BACKSPACE = 8;
    var UPARROW = 38;
    var DOWNARROW = 40;
    var PAGEUP = 33;
    var PAGEDOWN = 34;

    var MOUSE_ON_BUBBLE = false;

    // HTML snippets
    var $SUGGEST_BUBBLE = $('<div class="suggest-bubble"></div>');
    var $SUGGEST_LIST = $('<ul class="suggest-list"></ul>');
    $SUGGEST_BUBBLE.append($SUGGEST_LIST).append('<div class="suggest-next-page"><a href="#">&nabla; další strana &nabla;</a></div>');
    var $SUGGEST_FIELDS_BUBBLE = $(
        '<div class="suggest-fields-bubble">'           +"\n"+
        '    <div class="suggest-fields-list">'         +"\n"+
        '        <table></table>'                       +"\n"+
        '    </div>'                                    +"\n"+
        '</div>');                                      +"\n"
    $('body').append($SUGGEST_BUBBLE).append($SUGGEST_FIELDS_BUBBLE);
    var $ins = $('input[rel]').filter(function(){return $(this).parents('ul:first').attr('class').indexOf('Suggest') >= 0});

    // ['foo', 'bar'] => { foo: 1, bar: 1 }
    function arr2map(arr) {
        var map = {};
        for (var i = 0; i < arr.length; i++) {
            map[ arr[i] ] = 1;
        }
        return map;
    }

    // Keep track of where the suggest bubble currently belongs
    function set_current_input() {
        var $this = $(this);
        var $input;
        if (this.id.indexOf('_suggest') > 0)
            $input = $this;
        else
            var $ul = $this.filter(SUGGEST_SELECTOR);
            if (!$ul || $ul.length == 0)
                $ul = $this.parents(SUGGEST_SELECTOR);
            $input = $ul.eq(0).find('input').filter(function(){return this.id.indexOf('_suggest') > 0});
        $SUGGEST_BUBBLE.data('cur_input', $input);
    }
    // Export
    window.set_current_input = set_current_input;
    $(SUGGEST_SELECTOR).click( set_current_input ).focus( set_current_input );

    // Various initializations
    $('.hidden').hide();
    $ins.each(function() {
        // Parse the field names (?f=bla&f=ble)
        var rel = $(this).attr('rel');
        rel = rel.substr(rel.indexOf('?') + 1);
        var fields = $.map(rel.split(URL_VAR_SEPARATOR), function(n) {
            if (n.substr(0,2) == URL_FIELD_DENOTER+'=') {
                return n.substr(2);
            }
            else return;
        });

        $(this).data('fields', fields).attr('autocomplete', 'off');

        // Shave off the string representations from the hidden inputs upon form submit
        $(this).parents('form:first').submit(function() {
            $(this).find('input:hidden').each(function() {
                $(this).val( $(this).val().replace(/#.*/, '') );
            });
            return true;
        });

        // Make the popup-throwing magnifying glass not raise the default django event but rather ours which cooperates with the <ul> inputs
        var $lens = $('#lookup_'+this.id.replace('_suggest', ''));
        $lens.removeAttr('onclick').click(show_lookup_popup);
    });

    // Make the <ul>s behave like text input fields
    $(SUGGEST_SELECTOR).find('input:text').focus(function() {
        $(this).parents('ul:first').css('backgroundColor', '#F4F7FB');
    }).blur(function() {
        var $ul = $(this).parents('ul:first');
        $ul.css('backgroundColor', $ul.data('bgcolor'));
    }).each(function() {
        var $ul = $(this).parents('ul:first');
        $ul.data('bgcolor', $ul.css('backgroundColor'));
    });
    $('ul').filter(SUGGEST_SELECTOR).click(function() {
        $(this).find('input:text:visible:first').focus();
    });
    $('li.suggest-selected-item > a').click(set_current_input).click(delete_item);

    // Manipulation with the inputs
    function get_hidden($text) {
        return $('#'+$text.attr('id').replace('_suggest', ''));
    }
    function get_current_inputs(el) {
        var $text;
        if (el) {
            $text = $(el).parents(SUGGEST_SELECTOR).find('input').filter(function(){return this.id.indexOf('_suggest')>0});
        }
        else {
            $text = $SUGGEST_BUBBLE.data('cur_input');
        }
        var $hidden = get_hidden($text);
        var $ul = $text.parents('ul:first');
        return {text: $text, hidden: $hidden, ul: $ul};
    }
    // Make the <li>s clickable
    function goto_edit_item() {
        var $inputs = get_current_inputs(this);
        var id = $(this).data('item_id');
        var href = $inputs.text.attr('rel').replace(/suggest\/.*/, id+'/');
        if (id) location.href = href;
        return true;
    }
    $('li.suggest-selected-item').click(goto_edit_item);
    // Updates values of the hidden input based on the <li>s present
    function update_values(el) {
        var $inputs = get_current_inputs(el);
        var ids = [];
        var repres = [];
        $inputs.ul.find('li.suggest-selected-item').each(function() {
            ids.push( $(this).data('item_id') );
            repres.push( $.trim(this.firstChild.data) );
        });
        if (!is_multiple($inputs.ul) && ids.length > 1) {
            //TODO: warning
        }
        $inputs.hidden.val(ids.join(',') + '#' + repres.join(','));
        $inputs.text.data('values', arr2map(ids));
    }
    function parse_suggest_result(result, fields) {
        if (result == null || result.length == 0) return [];
        var results = result.split(SUGGEST_RECORD_SEPARATOR);
        var meta_str = results.shift();
        var meta;
        eval('meta = '+meta_str);
        if (results.length == 0) return [];
        var parsed_results = $.map(results, function(n) {
            var values = n.split(SUGGEST_FIELD_SEPARATOR);
            var parsed_result = { id: values.shift() };

            //TODO: warning if (fields.length != values.length);

            var repre = '';
            for (var i = 0; i < values.length; i++) {
                parsed_result[ fields[i] ] = values[i];
                if (repre.length == 0) repre = values[i];
            }
            parsed_result.REPRE = repre || parsed_result.id;
            return parsed_result;
        });
        parsed_results.meta = meta;
        return parsed_results;
    }
    function new_item(item_id, item_str) {
        var $newli = $('<li class="suggest-selected-item">');
        $newli.click(set_current_input).click(goto_edit_item);
        var $newdel = $('<a class="suggest-delete-link"><img src="'+DEL_IMG+'" alt="x" /></a>');
        $newdel.click(set_current_input).click(delete_item);
        $newli.html( item_str ).append( $newdel ).data( 'item_id', item_id );
        return $newli;
    }
    // Adds a value (in case of multiples) or sets the value (in case of singles)
    function insert_value (id, repre, el) {
        var $inputs = get_current_inputs(el);
        var multiple = is_multiple($inputs.ul);
        $inputs.ul.removeData('offset');
        var $newli = new_item(id, repre);
        $inputs.text.val('');
        var $prev = $inputs.text.parent().prev('li');
        $inputs.text.parent().before($newli);
        if (!multiple && $prev && $prev.length > 0) {
            $prev.remove();
        }
        update_values(el);
        $inputs.text.focus();
        $SUGGEST_LIST.empty();
        hide_bubbles();
        MOUSE_ON_BUBBLE = false;
    }
    // export this function
    window.insert_value = insert_value;

    // Enhance textual X's of delete links with graphical crosses used at the "delete this item from database" link
    $('li.suggest-selected-item a').html('<img src="'+DEL_IMG+'" alt="x" />')

    // Ensure that the initial values fit
    $ins.each(function() {
        var $inputs = get_current_inputs( this );
        if ( /^(.+)#(.+)$/.test($inputs.hidden.val()) ) {
            var ids    = RegExp.$1;
            var repres = RegExp.$2;
            ids    = ids.match(/\d+/g);
            repres = repres.match(/[^,]+/g);
            if (!ids || !repres || ids.length != repres.length) ids = repres = [];
            $inputs.ul.find('li.suggest-selected-item').remove();
            while (ids.length > 0) {
                var id    = ids.pop();
                var repre = repres.pop();
                item = new_item(id, repre);
                $inputs.ul.prepend(item);
            }
        }
        else if ( /^([\d,]+)$/.test($inputs.hidden.val()) ) {
            var raw_ids = RegExp.$1;
            var ids = raw_ids.match(/\d+/g);
            var $lis = $inputs.ul.find('li.suggest-selected-item');
            var repres = $.map( $.makeArray($lis), function(n) {
                return $.trim( n.firstChild.data );
            });
            if (repres && ids && repres.length == ids.length) {
                $lis.each(function(i) {
                    $(this).data('item_id', ids[i]);
                });
            }
        }
    });
    $ins.each(function() {
        update_values($(this));
    });

    function hide_bubbles() {
        $SUGGEST_BUBBLE.hide();
        $SUGGEST_FIELDS_BUBBLE.hide();
    }
    function is_multiple( $el ) {
        if ($el.hasClass('GenericSuggestFieldMultiple')) return true;
        if ($el.parents('.GenericSuggestFieldMultiple').length > 0) return true;
        return false;
    }
    function delete_item() {
        var $li = $(this).parent();
        $li.remove();
        update_values();
        get_current_inputs().text.focus();
    }
    function suggest_select($sug_item) {
        var item_id = $sug_item.data('sug_result').id;
        var item_str = $sug_item.data('sug_result').REPRE;
        insert_value(item_id, item_str);
    }
    function suggest_update($input, offset) {
        var val = $input.val();
        if (val.length < MIN_LENGTH) {
            hide_bubbles();
            return;
        }
        // create a regexp that will match every occurrence of the text input value
        var val_re = new RegExp( '(' + val.replace(/([^\w\s])/g, '\\$1') + ')', 'ig' ); // the replace does /\Q$val/
        var sug_url = $input.attr('rel');

        if (offset == null || offset < 0)
            offset = 0;
        if (offset > 0) {
            sug_url = sug_url.replace('&q', '&o='+offset+'&q');
        }
        $input.data('offset', offset);

        $.get(sug_url+val, {}, function(sug_result) {
            if (sug_result == 'SPECIAL: OFFSET OUT OF RANGE') {
                suggest_update($input, 0);
                return;
            }
            $SUGGEST_LIST.empty();
            $input.each(set_current_input); // sets $input as the current input
            var fields = $input.data('fields');
            var parsed_results = parse_suggest_result(sug_result, fields)
            var meta = parsed_results.meta;

            // don't suggest what's already selected
            parsed_results = $.grep(parsed_results, function(parsed_result) {
                if ($input.data('values')[ parsed_result.id ])
                    return false;
                else
                    return true;
            });

            if (parsed_results.length == 0) {
                hide_bubbles();
            }
            else {
                var no_items = parsed_results.length;
                if (offset + no_items >= meta.cnt) {
                    $SUGGEST_BUBBLE.find('.suggest-next-page').hide();
                }
                else {
                    $SUGGEST_BUBBLE.find('.suggest-next-page').show();
                }
                $.map(parsed_results, function(parsed_result) {
                    var $elem = $('<li>');
                    $elem.data('sug_result', parsed_result);
                    $elem.html(parsed_result.REPRE.replace(val_re, '<span class="hilite">$1</span>'));
                    $SUGGEST_LIST.append($elem);
                    $elem.click( function() {
                        suggest_select($elem);
                    }).hover( function() {
                        set_field_bubble($(this));
                    }, function() {
                        $SUGGEST_FIELDS_BUBBLE.hide();
                    });
                });
                var pos = $input.offset();
                pos.top += $input.outerHeight();
                $SUGGEST_BUBBLE.css({
                    left: pos.left,
                    top:  pos.top,
                }).show();
            }
        });
    }
    function suggest_scroll($input, key) {
        $SUGGEST_FIELDS_BUBBLE.hide();
        var $lis = $SUGGEST_LIST.find('li');
        var $active_elem = $lis.filter('.A:first');
        $lis.removeClass('A');
        if (key == DOWNARROW) {
            if ($active_elem.length == 0)
                $active_elem = $lis.eq(0);
            else {
                $active_elem = $active_elem.next();
                if ($active_elem.length == 0) { // request next page
                    suggest_scroll_page(1, $input);
                    return;
                }
            }
        }
        if (key == UPARROW) {
            if ($active_elem.length == 0)
                $active_elem = $lis.filter(':last');
            else {
                $active_elem = $active_elem.prev();
                if ($active_elem.length == 0) { // request previous page
                    suggest_scroll_page(-1, $input);
                    return;
                }
            }
        }
        $active_elem.addClass('A');
        set_field_bubble( $active_elem );
        return;
    }
    function suggest_scroll_page(delta, $input) {
        if ($input == null) $input = get_current_inputs().text;
        var offset = $input.data('offset') + delta * $SUGGEST_LIST.find('li').length;
        suggest_update($input, offset);
    }
    function set_field_bubble($item) {
        var sug_result = $item.data('sug_result');
        var list = [];
        var i = 0;
        for (var k in sug_result) {
            if (i++ == 1) { first = false; continue; }
            if (k == 'REPRE') continue;
            list.push('<tr><th>' + k + '</th><td>' + sug_result[ k ] + '</td></tr>');
        }
        if (list.length == 0) {
            $SUGGEST_FIELDS_BUBBLE.hide();
            return;
        }
        var pos = $item.offset();
        $SUGGEST_FIELDS_BUBBLE.find('table').empty().append(
            list.join("\n")
        ).end().css({
            top:  pos.top + $item.height()/2 - $SUGGEST_FIELDS_BUBBLE.height()/2,
            left: pos.left + $item.outerWidth()
        }).show();
    }
    function bubble_keyevent(key, $input) {
        if ($input == null) input = get_current_inputs().text;
        switch (key) {
        case ESC:
            hide_bubbles();
            $input.val('');
            break;
        case UPARROW:
        case DOWNARROW:
            suggest_scroll($input, key);
            break;
        case CR:
        case LF:
            if ($SUGGEST_BUBBLE.is(':visible')) {
                var $active_li = $SUGGEST_LIST.find('li.A:first');
                if ($active_li.length == 0)
                    $active_li = $SUGGEST_LIST.find('li:first');
                suggest_select($active_li);
            }
            break;
        case PAGEUP:
        case PAGEDOWN:
            var delta = (key == PAGEUP) ? -1 : 1;
            suggest_scroll_page(delta, $input);
            break;
        }
    }
    $ins.keyup( function($event) {
        var $this = $(this);
        var key = $event.keyCode;
        if (  key == CR || key ==   UPARROW || key == PAGEUP
           || key == LF || key == DOWNARROW || key == PAGEDOWN
        ) return;
        else if (key == ESC) {
            bubble_keyevent(key, $this);
            return;
        }
        else {
            suggest_update($this);
            return;
        }
    });
    $ins.keypress( function($event) {
        var key = $event.keyCode;
        var $this = $(this);
        if (  key == CR || key ==   UPARROW || key == PAGEUP
           || key == LF || key == DOWNARROW || key == PAGEDOWN
        ) {
            bubble_keyevent(key, $this);
            return false;
        }
        else if (key == BACKSPACE && $this.val().length == 0) {
            var $prev = $this.parent().prev();
            if ($prev.length == 0) return;
            $this.val('');
            $prev.remove();
            update_values();
        }
        return true;
    });
    $ins.blur( function() {
        if (!MOUSE_ON_BUBBLE)
            hide_bubbles();
    });
    $ins.focus( function() {
        if ($(this).data('internal_focus')) {
            $(this).removeData('internal_focus');
        }
        else {
            suggest_update( $(this) );
        }
    });

    // Setup the behavior of the next-page widget
    $('div.suggest-next-page a').click(function() {
        suggest_scroll_page(1);
        return false;
    }).focus(function() {
        var $input = get_current_inputs().text;
        $input.data('internal_focus', 1);
        $input.focus();
    });

    $SUGGEST_BUBBLE.bind('mouseenter', function(){ MOUSE_ON_BUBBLE = true;  return true; });
    $SUGGEST_BUBBLE.bind('mouseleave', function(){ MOUSE_ON_BUBBLE = false; return true; });
}); })(jQuery);

// Functions for handling popups (lupička) taken from django admin
function parse_lupicka_data(data) {
    data = data.substring( data.indexOf('<table'), data.indexOf('</table>')+8 );
    var $data = $('<div>').html(data);
    var col_names = $.map( $.makeArray($data.find('thead th')), function(n){return $.trim($(n).text())} );
    var $trs = $data.find('tbody tr');
    var rv = [col_names];
    $trs.each(function() {
        var rec = $.map( $.makeArray( $(this).find('th,td') ), function(n) { return $.trim( $(n).text() ); } );
        $(this).find('th a').attr('href').match(/(\d+)\/$/);
        var id = RegExp.$1;
        rec.push( id );
        rv.push(rec);
    });
    return rv;
}
function get_popup_content( href, $popup ) {
    $.ajax({
        url: href,
        success: function(data) {
            var rows = parse_lupicka_data(data);
            var col_names = rows.shift();
            var $table = $("<table></table>\n");
            var $header = $("<tr></tr>\n");
            for (var i = 0; i < col_names.length; i++) {
                $header.append('<th>' + col_names[i] + '</th>');
            }
            $table.append($header);
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var id = row.pop();
                $( '<tr><td>'+
                    rows[i].join('</td><td>')
                    +"</td></tr>\n"
                )
                .data('id',id)
                .appendTo($table);
            }
            $table.find('tr:gt(0)').click( function() {
                var chosenId = $(this).data('id');
                var item_str = $.trim( $(this).find('td,th').eq(0).text() );
                var elem = document.getElementById( $('div.lupicka-popup').data('input_id') );
                insert_value(chosenId, item_str, elem);
                dismiss_lookup_popup();
            });
            var $pagin_cont = $('<div class="fakewin-paginator">1 2 3 4 5</div>');
            $popup.empty().append($('<div class="table"></div>').append($table)).append($pagin_cont);
        }
    });
}
function show_lookup_popup() {
    var name = this.id.replace(/^lookup_/, '');
    var href;
    if (this.href.search(/\?/) >= 0) {
        href = this.href + '&pop=1';
    } else {
        href = this.href + '?pop=1';
    }

    var $related_item = $('#'+name+'_suggest').parents('.GenericSuggestField,.GenericSuggestFieldMultiple').eq(0);

    // Create the fake popup window
    dismiss_lookup_popup();
    var $popup_w = $(
        '<div class="lupicka-popup fakewin">'                       +"\n"+
        '    <div class="fakewin-title">'                           +"\n"+
        '        <div class="fakewin-titletext"></div>'             +"\n"+
        '        <div class="fakewin-closebutton">&times;</div>'    +"\n"+
        '        <div class="clearfix"></div>'                      +"\n"+
        '    </div>'                                                +"\n"+
        '    <div class="fakewin-content">'                         +"\n"+
        '    </div>'                                                +"\n"+
        '</div>'                                                    +"\n"
    );
    $popup_w.data('input', $related_item);
    $related_item.addClass('pod-lupickou');
    $popup_w.draggable().draggable('disable').resizable().data('input_id', name+'_suggest')
    .find('.fakewin-title').bind('mouseenter', function() {
        $popup_w.draggable('enable');
    }).bind('mouseleave', function() {
        $popup_w.draggable('disable');
    }).find('.fakewin-titletext').html('&nbsp;')
    .end().find('.fakewin-closebutton').click(dismiss_lookup_popup);
    var $popup = $popup_w.find('div.fakewin-content');
    $popup.text('Loading...');
    $('body').append( $popup_w );
    get_popup_content(href, $popup);
    return false;
}
function dismiss_lookup_popup() {
    var $w = $('div.lupicka-popup:first');
    if ($w.length == 0) return;
    $w.data('input').removeClass('pod-lupickou');
    $w.remove();
}
