;(function (window, $, undefined) {

    function range(from, to) {
        return Array(to - from + 1).fill().map((_, idx) => from + idx)
    }

    ;(function () {

        let VERSION = '3',
            pluginName = 'datepicker',
            autoInitSelector = '.datepicker-here',
            $body, $datepickersContainer,
            containerBuilt = false,
            baseTemplate = '' +
                '<div class="datepicker">' +
                '<i class="datepicker--pointer"></i>' +
                '<nav class="datepicker--nav"></nav>' +
                '<div class="datepicker--content"></div>' +
                '</div>',
            invalidDateClass = '--date-invalid',
            defaults = {
                classes: '',
                inline: false,
                language: 'en',
                startDate: '',
                firstDay: '',
                defaultToday: false,
                weekends: [6, 0],
                dateFormat: '',
                dateFormatRegx: '',

                altField: '',
                altFieldDateFormat: '@',
                toggleSelected: true,
                keyboardNav: true,

                timeZoneData: 'UTC',
                timeZoneView: 'Europe/London',

                position: 'bottom left',
                offset: 12,

                view: 'days',
                minView: 'days',

                showOtherMonths: true,
                selectOtherMonths: true,
                moveToOtherMonthsOnSelect: true,

                showOtherYears: true,
                selectOtherYears: true,
                moveToOtherYearsOnSelect: true,

                minDate: '',
                maxDate: '',

                disableNavWhenOutOfRange: true,

                multipleDates: false, // Boolean or Number
                multipleDatesSeparator: ',',
                range: false,

                todayButton: false,
                clearButton: false,

                showEvent: 'focus',
                autoClose: false,

                // navigation
                monthsField: 'monthsShort',
                prevHtml: '<svg><path d="M 17,12 l -5,5 l 5,5"></path></svg>',
                nextHtml: '<svg><path d="M 14,12 l 5,5 l -5,5"></path></svg>',
                navTitles: {
                    days: 'MMM, <i>YYYY</i>',
                    months: 'YYYY',
                    years: 'YYYY1 - YYYY2'
                },

                // timepicker
                timepicker: false,
                onlyTimepicker: false,
                dateTimeSeparator: ' ',
                timeFormat: '',
                timeFormatRegx: '',
                minHours: 0,
                maxHours: 24,
                minMinutes: 0,
                maxMinutes: 59,
                hoursStep: 1,
                minutesStep: 1,

                // events
                onSelect: '',
                onShow: '',
                onHide: '',
                onChangeMonth: '',
                onChangeYear: '',
                onChangeDecade: '',
                onChangeView: '',
                onRenderCell: '',

                // manual input date
                manualInput: true
            },
            hotKeys = {
                'ctrlRight': [17, 39],
                'ctrlUp': [17, 38],
                'ctrlLeft': [17, 37],
                'ctrlDown': [17, 40],
                'shiftRight': [16, 39],
                'shiftUp': [16, 38],
                'shiftLeft': [16, 37],
                'shiftDown': [16, 40],
                'altUp': [18, 38],
                'altRight': [18, 39],
                'altLeft': [18, 37],
                'altDown': [18, 40],
                'ctrlShiftUp': [16, 17, 38]
            },
            manualInputKeyRegx = /^[0-9a-zA-Z\s:]$/g,
            datepicker;

        let Datepicker = function (el, options) {

            this.el = el;
            this.$el = $(el);

            this.opts = $.extend(true, {}, defaults, options, this.$el.data());

            if ($body == undefined) {
                $body = $('body');
            }

            if (this.opts.startDate) {
                this.opts.startDate = moment(this.opts.startDate).tz(this.opts.timeZoneView);
            } else {
                this.opts.startDate = moment.tz(this.opts.timeZoneView);
            }

            if (this.el.nodeName == 'INPUT') {
                this.elIsInput = true;
            }

            if (this.opts.altField) {
                this.$altField = typeof this.opts.altField == 'string' ? $(this.opts.altField) : this.opts.altField;
            }

            this.inited = false;
            this.visible = false;
            this.silent = false; // Need to prevent unnecessary rendering

            this.currentDate = this.opts.startDate;
            this.currentView = this.opts.view;
            this._createShortCuts();
            this.selectedDates = [];
            this.views = {};
            this.keys = [];
            this.minRange = '';
            this.maxRange = '';
            this._prevOnSelectValue = '';

            this.manualInputTimer = null;

            this.init()
        };

        datepicker = Datepicker;

        datepicker.prototype = {
            VERSION: VERSION,
            viewIndexes: ['days', 'months', 'years'],

            init: function () {
                if (!containerBuilt && !this.opts.inline && this.elIsInput) {
                    this._buildDatepickersContainer();
                }
                this._buildBaseHtml();
                this._defineLocale(this.opts.language);
                this._syncWithMinMaxDates();

                if (this.elIsInput) {
                    if (!this.opts.inline) {
                        // Set extra classes for proper transitions
                        this._setPositionClasses(this.opts.position);
                        this._bindEvents()
                    }
                    if (this.opts.keyboardNav && !this.opts.onlyTimepicker) {
                        this._bindKeyboardEvents();
                    }
                    this.$datepicker.on('mousedown', this._onMouseDownDatepicker.bind(this));
                    this.$datepicker.on('mouseup', this._onMouseUpDatepicker.bind(this));
                }

                if (this.opts.classes) {
                    this.$datepicker.addClass(this.opts.classes)
                }

                if (this.opts.timepicker) {
                    this.timepicker = new $.fn.datepicker.Timepicker(this, this.opts);
                    this._bindTimepickerEvents();
                }

                if (this.opts.onlyTimepicker) {
                    this.$datepicker.addClass('-only-timepicker-');
                }

                this.views[this.currentView] = new $.fn.datepicker.Body(this, this.currentView, this.opts);
                this.views[this.currentView].show();
                this.nav = new $.fn.datepicker.Navigation(this, this.opts);
                this.view = this.currentView;

                this.$el.on('clickCell.adp', this._onClickCell.bind(this));
                this.$datepicker.on('mouseenter', '.datepicker--cell', this._onMouseEnterCell.bind(this));
                this.$datepicker.on('mouseleave', '.datepicker--cell', this._onMouseLeaveCell.bind(this));

                this._presetDate();

                this.inited = true;
            },

            _presetDate: function () {
                let _this = this,
                    dates;

                if (_this.opts.altField) {
                    dates = _this.$altField.val();
                } else {
                    dates = _this.$el.val()
                }

                if (dates) {

                    dates = dates.split(_this.opts.multipleDatesSeparator).map(function (string) {
                        if (_this.opts.altField && _this.opts.timepicker)
                            return moment.tz(string, _this.altFieldDateFormat, _this.opts.timeZoneData).tz(_this.opts.timeZoneView);
                        else
                            return moment.tz(string, _this.dateFormat, _this.opts.timeZoneView);
                    });

                } else {
                    if (!this.opts.defaultToday) return;
                    dates = [this.now];
                }

                _this.selectDate(dates);
            },

            _createShortCuts: function () {
                this.minDate = this.opts.minDate ? this.opts.minDate : moment(new Date(-8639999913600000));
                this.maxDate = this.opts.maxDate ? this.opts.maxDate : moment(new Date(8639999913600000));
            },

            _bindEvents: function () {
                this.$el.on(this.opts.showEvent + '.adp', this._onShowEvent.bind(this));
                this.$el.on('mouseup.adp', this._onMouseUpEl.bind(this));
                this.$el.on('blur.adp', this._onBlur.bind(this));
                this.$el.on('keyup.adp', this._onKeyUpGeneral.bind(this));
                $(window).on('resize.adp', this._onResize.bind(this));
                $('body').on('mouseup.adp', this._onMouseUpBody.bind(this));
            },

            _bindKeyboardEvents: function () {
                this.$el.on('keydown.adp', this._onKeyDown.bind(this));
                this.$el.on('keyup.adp', this._onKeyUp.bind(this));
                this.$el.on('hotKey.adp', this._onHotKey.bind(this));
            },

            _bindTimepickerEvents: function () {
                this.$el.on('timeChange.adp', this._onTimeChange.bind(this));
            },

            isWeekend: function (day) {
                return this.opts.weekends.indexOf(day) !== -1;
            },

            _defineLocale: function (lang) {
                if (typeof lang == 'string') {
                    this.loc = $.fn.datepicker.language[lang];
                    if (!this.loc) {
                        console.warn('Can\'t find language "' + lang + '" in Datepicker.language, will use "ru" instead');
                        this.loc = $.extend(true, {}, $.fn.datepicker.language.ru)
                    }

                    this.loc = $.extend(true, {}, $.fn.datepicker.language.ru, $.fn.datepicker.language[lang])
                } else {
                    this.loc = $.extend(true, {}, $.fn.datepicker.language.ru, lang)
                }

                if (this.opts.dateFormat) {
                    this.loc.dateFormat = this.opts.dateFormat
                    if (this.opts.dateFormatRegx) {
                        this.loc.dateFormatRegx = this.opts.dateFormatRegx
                    } else {
                        console.warn('DateFormat specified but dateFormatRegx not specified');
                    }
                }

                if (this.opts.timeFormat) {
                    this.loc.timeFormat = this.opts.timeFormat
                    if (this.opts.timeFormatRegx) {
                        this.loc.timeFormatRegx = this.opts.timeFormatRegx
                    } else {
                        console.warn('TimeFormat specified but timeFormatRegx not specified');
                    }
                }

                if (this.opts.firstDay !== '') {
                    this.loc.firstDay = this.opts.firstDay
                }

                if (this.opts.timepicker) {
                    this.loc.dateFormat = [this.loc.dateFormat, this.loc.timeFormat].join(this.opts.dateTimeSeparator);
                    if (this.loc.dateFormatRegx && this.loc.timeFormatRegx) {
                        this.loc.dateFormatRegx = [this.loc.dateFormatRegx, this.loc.timeFormatRegx].join(' ');
                    } else {
                        this.loc.dateFormatRegx = '';
                    }
                }

                if (this.opts.onlyTimepicker) {
                    this.loc.dateFormat = this.loc.timeFormat;
                }

                let boundary = this._getWordBoundaryRegExp;
                if (this.loc.timeFormat.match(boundary('aa')) ||
                    this.loc.timeFormat.match(boundary('AA'))
                ) {
                    this.ampm = true;
                }
            },

            _buildDatepickersContainer: function () {
                containerBuilt = true;
                $body.append('<div class="datepickers-container" id="datepickers-container"></div>');
                $datepickersContainer = $('#datepickers-container');
            },

            _buildBaseHtml: function () {
                let $appendTarget,
                    $inline = $('<div class="datepicker-inline">');

                if (this.el.nodeName == 'INPUT') {
                    if (!this.opts.inline) {
                        $appendTarget = $datepickersContainer;
                    } else {
                        $appendTarget = $inline.insertAfter(this.$el)
                    }
                } else {
                    $appendTarget = $inline.appendTo(this.$el)
                }

                this.$datepicker = $(baseTemplate).appendTo($appendTarget);
                this.$content = $('.datepicker--content', this.$datepicker);
                this.$nav = $('.datepicker--nav', this.$datepicker);
            },

            _triggerOnChange: function () {
                if (!this.selectedDates.length) {
                    // Prevent from triggering multiple onSelect callback with same argument (empty string) in IE10-11
                    if (this._prevOnSelectValue === '') return;
                    this._prevOnSelectValue = '';
                    return this.opts.onSelect('', '', this);
                }

                let selectedDates = this.selectedDates,
                    formattedDates,
                    _this = this,
                    dates = selectedDates[0].clone();

                formattedDates = selectedDates.map(function (date) {
                    return date.format(_this.loc.dateFormat);
                }).join(this.opts.multipleDatesSeparator);

                // Create new dates array, to separate it from original selectedDates
                if (this.opts.multipleDates || this.opts.range) {
                    dates = selectedDates.map(function (date) {
                        return date.clone();
                    })
                }

                this._prevOnSelectValue = formattedDates;
                this.opts.onSelect(formattedDates, dates, this);
            },

            next: function () {
                let d = this.parsedDate,
                    o = this.opts;
                switch (this.view) {
                    case 'days':

                        let y, m;
                        if (d.month === 11) {
                            m = 0;
                            y = d.year + 1;
                        } else {
                            m = d.month + 1;
                            y = d.year;
                        }

                        this.date = this.getNewDate(y, m, 1);
                        if (o.onChangeMonth) o.onChangeMonth(this.parsedDate.month, this.parsedDate.year);
                        break;

                    case 'months':
                        this.date = this.getNewDate(d.year + 1, d.month, 1);
                        if (o.onChangeYear) o.onChangeYear(this.parsedDate.year);
                        break;
                    case 'years':
                        this.date = this.getNewDate(d.year + 10, 0, 1);
                        if (o.onChangeDecade) o.onChangeDecade(this.curDecade);
                        break;
                }
            },

            prev: function () {
                let d = this.parsedDate,
                    o = this.opts;
                switch (this.view) {
                    case 'days':

                        let y, m;
                        if (d.month === 0) {
                            m = 11;
                            y = d.year - 1;
                        } else {
                            m = d.month - 1;
                            y = d.year;
                        }

                        this.date = this.getNewDate(y, m, 1);
                        if (o.onChangeMonth) o.onChangeMonth(this.parsedDate.month, this.parsedDate.year);
                        break;

                    case 'months':
                        this.date = this.getNewDate(d.year - 1, d.month, 1);
                        if (o.onChangeYear) o.onChangeYear(this.parsedDate.year);
                        break;
                    case 'years':
                        this.date = this.getNewDate(d.year - 10, 0, 1);
                        if (o.onChangeDecade) o.onChangeDecade(this.curDecade);
                        break;
                }
            },

            _getWordBoundaryRegExp: function (sign) {
                let symbols = '\\s|\\.|-|/|\\\\|,|\\$|\\!|\\?|:|;';

                return new RegExp('(^|>|' + symbols + ')(' + sign + ')($|<|' + symbols + ')', 'g');
            },

            /**
             * @param date moment
             */
            selectDate: function (date) {

                let _this = this,
                    opts = _this.opts,
                    d = _this.parsedDate,
                    selectedDates = _this.selectedDates,
                    len = selectedDates.length,
                    newDate = '';

                if (Array.isArray(date)) {
                    date.forEach(function (d) {
                        _this.selectDate(d)
                    });
                    return;
                }

                if (!(date instanceof moment)) return;

                this.lastSelectedDate = date;

                // Set new time values from Date
                if (this.timepicker) {
                    this.timepicker._setTime(date);
                }

                // On this step timepicker will set valid values in it's instance
                _this._trigger('selectDate', date);

                // Set correct time values after timepicker's validation
                // Prevent from setting hours or minutes which values are lesser then `min` value or
                // greater then `max` value
                if (this.timepicker) {
                    date.hours(this.timepicker.hours);
                    date.minutes(this.timepicker.minutes)
                }

                if (_this.view == 'days') {
                    if (date.month() != d.month && opts.moveToOtherMonthsOnSelect) {
                        newDate = date.clone().date(1);
                    }
                }

                if (_this.view == 'years') {
                    if (date.year() != d.year && opts.moveToOtherYearsOnSelect) {
                        newDate = date.clone().month(0).date(1);
                    }
                }

                if (newDate) {
                    _this.silent = true;
                    _this.date = newDate;
                    _this.silent = false;
                    _this.nav._render()
                }

                if (opts.multipleDates && !opts.range) { // Set priority to range functionality
                    if (len === opts.multipleDates) return;
                    if (!_this._isSelected(date)) {
                        _this.selectedDates.push(date);
                    }
                } else if (opts.range) {
                    if (len == 2) {
                        _this.selectedDates = [date];
                        _this.minRange = date;
                        _this.maxRange = '';
                    } else if (len == 1) {
                        _this.selectedDates.push(date);
                        if (!_this.maxRange) {
                            _this.maxRange = date;
                        } else {
                            _this.minRange = date;
                        }
                        // Swap dates if they were selected via dp.selectDate() and second date was smaller then first
                        if (datepicker.bigger(_this.maxRange, _this.minRange)) {
                            _this.maxRange = _this.minRange;
                            _this.minRange = date;
                        }
                        _this.selectedDates = [_this.minRange, _this.maxRange]

                    } else {
                        _this.selectedDates = [date];
                        _this.minRange = date;
                    }
                } else {
                    _this.selectedDates = [date];
                }

                _this._setInputValue();

                if (opts.onSelect) {
                    _this._triggerOnChange();
                }

                if (opts.autoClose && !this.timepickerIsActive) {
                    if (!opts.multipleDates && !opts.range) {
                        _this.hide();
                    } else if (opts.range && _this.selectedDates.length == 2) {
                        _this.hide();
                    }
                }

                _this.views[this.currentView]._render()
            },

            removeDate: function (date) {
                let selected = this.selectedDates,
                    _this = this;

                if (!(date instanceof Date)) return;

                return selected.some(function (curDate, i) {
                    if (datepicker.isSame(curDate, date)) {
                        selected.splice(i, 1);

                        if (!_this.selectedDates.length) {
                            _this.minRange = '';
                            _this.maxRange = '';
                            _this.lastSelectedDate = '';
                        } else {
                            _this.lastSelectedDate = _this.selectedDates[_this.selectedDates.length - 1];
                        }

                        _this.views[_this.currentView]._render();
                        _this._setInputValue();

                        if (_this.opts.onSelect) {
                            _this._triggerOnChange();
                        }

                        return true
                    }
                })
            },

            today: function () {
                this.silent = true;
                this.view = this.opts.minView;
                this.silent = false;
                this.date = this.now;

                if (this.opts.todayButton instanceof moment) {
                    this.selectDate(this.opts.todayButton)
                }
            },

            clear: function () {
                this.selectedDates = [];
                this.minRange = '';
                this.maxRange = '';
                this.views[this.currentView]._render();
                this._setInputValue();
                if (this.opts.onSelect) {
                    this._triggerOnChange()
                }
            },

            /**
             * Updates datepicker options
             * @param {String|Object} param - parameter's name to update. If object then it will extend current options
             * @param {String|Number|Object} [value] - new param value
             */
            update: function (param, value) {
                let len = arguments.length,
                    lastSelectedDate = this.lastSelectedDate;

                if (len == 2) {
                    this.opts[param] = value;
                } else if (len == 1 && typeof param == 'object') {
                    this.opts = $.extend(true, this.opts, param)
                }

                this._createShortCuts();
                this._syncWithMinMaxDates();
                this._defineLocale(this.opts.language);
                this.nav._addButtonsIfNeed();
                if (!this.opts.onlyTimepicker) this.nav._render();
                this.views[this.currentView]._render();

                if (this.elIsInput && !this.opts.inline) {
                    this._setPositionClasses(this.opts.position);
                    if (this.visible) {
                        this.setPosition(this.opts.position)
                    }
                }

                if (this.opts.classes) {
                    this.$datepicker.addClass(this.opts.classes)
                }

                if (this.opts.onlyTimepicker) {
                    this.$datepicker.addClass('-only-timepicker-');
                }

                if (this.opts.timepicker) {
                    if (lastSelectedDate) this.timepicker._handleDate(lastSelectedDate);
                    this.timepicker._updateRanges();
                    this.timepicker._updateCurrentTime();
                    // Change hours and minutes if it's values have been changed through min/max hours/minutes
                    if (lastSelectedDate) {
                        lastSelectedDate.hours(this.timepicker.hours);
                        lastSelectedDate.minutes(this.timepicker.minutes);
                    }
                }

                this._setInputValue();

                return this;
            },

            _syncWithMinMaxDates: function () {
                let curTime = this.date.valueOf();

                this.silent = true;

                if (this.minTime > curTime) {
                    this.date = this.minDate;
                }

                if (this.maxTime < curTime) {
                    this.date = this.maxDate;
                }
                this.silent = false;
            },

            _isSelected: function (checkDate, cellType) {
                let res = false;
                this.selectedDates.some(function (date) {
                    if (datepicker.isSame(date, checkDate, cellType)) {
                        res = date;
                        return true;
                    }
                });
                return res;
            },

            _setInputValue: function () {
                let _this = this,
                    opts = _this.opts,
                    format = _this.loc.dateFormat,
                    altFormat = opts.altFieldDateFormat,
                    values = _this.selectedDates.map(function (date) {
                        return date.format(format);
                    }),
                    altValues;

                if (opts.altField && _this.$altField.length) {

                    altValues = this.selectedDates.map(function (date) {
                        return (opts.timepicker) ?
                            date.clone().tz(opts.timeZoneData).format(altFormat)
                            : date.format(altFormat);
                    });

                    altValues = altValues.join(this.opts.multipleDatesSeparator);
                    this.$altField.val(altValues);
                }

                values = values.join(this.opts.multipleDatesSeparator);

                this.$el.val(values)
            },

            /**
             * Check if date is between minDate and maxDate
             * @param date {object} - date object
             * @param type {string} - cell type
             * @returns {boolean}
             * @private
             */
            _isInRange: function (date, type) {
                let time = date.valueOf(),
                    d = datepicker.getParsedDate(date),
                    min = datepicker.getParsedDate(this.minDate),
                    max = datepicker.getParsedDate(this.maxDate),
                    dMinTime = this.getNewDate(d.year, d.month, min.date).valueOf(),
                    dMaxTime = this.getNewDate(d.year, d.month, max.date).valueOf(),
                    types = {
                        day: time >= this.minTime && time <= this.maxTime,
                        month: dMinTime >= this.minTime && dMaxTime <= this.maxTime,
                        year: d.year >= min.year && d.year <= max.year
                    };
                return type ? types[type] : types.day
            },

            _getDimensions: function ($el) {
                let offset = $el.offset();

                return {
                    width: $el.outerWidth(),
                    height: $el.outerHeight(),
                    left: offset.left,
                    top: offset.top
                }
            },

            _getDateFromCell: function (cell) {
                let curDate = this.parsedDate,
                    year = cell.data('year') || curDate.year,
                    month = cell.data('month') == undefined ? curDate.month : cell.data('month'),
                    date = cell.data('date') || 1;

                return this.getNewDate(year, month, date);
            },

            _setPositionClasses: function (pos) {
                pos = pos.split(' ');
                let main = pos[0],
                    sec = pos[1],
                    classes = 'datepicker -' + main + '-' + sec + '- -from-' + main + '-';

                if (this.visible) classes += ' active';

                this.$datepicker
                    .removeAttr('class')
                    .addClass(classes);
            },

            setPosition: function (position) {
                position = position || this.opts.position;

                let dims = this._getDimensions(this.$el),
                    selfDims = this._getDimensions(this.$datepicker),
                    pos = position.split(' '),
                    top, left,
                    offset = this.opts.offset,
                    main = pos[0],
                    secondary = pos[1];

                switch (main) {
                    case 'top':
                        top = dims.top - selfDims.height - offset;
                        break;
                    case 'right':
                        left = dims.left + dims.width + offset;
                        break;
                    case 'bottom':
                        top = dims.top + dims.height + offset;
                        break;
                    case 'left':
                        left = dims.left - selfDims.width - offset;
                        break;
                }

                switch (secondary) {
                    case 'top':
                        top = dims.top;
                        break;
                    case 'right':
                        left = dims.left + dims.width - selfDims.width;
                        break;
                    case 'bottom':
                        top = dims.top + dims.height - selfDims.height;
                        break;
                    case 'left':
                        left = dims.left;
                        break;
                    case 'center':
                        if (/left|right/.test(main)) {
                            top = dims.top + dims.height / 2 - selfDims.height / 2;
                        } else {
                            left = dims.left + dims.width / 2 - selfDims.width / 2;
                        }
                }

                this.$datepicker
                    .css({
                        left: left,
                        top: top
                    })
            },

            show: function () {
                let onShow = this.opts.onShow;

                this.setPosition(this.opts.position);
                this.$datepicker.addClass('active');
                this.visible = true;

                if (onShow) {
                    this._bindVisionEvents(onShow)
                }
            },

            hide: function () {
                if (!this.visible) return;

                let onHide = this.opts.onHide;

                this.$datepicker
                    .removeClass('active')
                    .css({
                        left: '-100000px'
                    });

                this.focused = '';
                this.keys = [];

                this.inFocus = false;
                this.visible = false;
                this.$el.blur().change();

                if (onHide) {
                    this._bindVisionEvents(onHide)
                }
            },

            down: function (date) {
                this._changeView(date, 'down');
            },

            up: function (date) {
                this._changeView(date, 'up');
            },

            _bindVisionEvents: function (event) {
                this.$datepicker.off('transitionend.dp');
                event(this, false);
                this.$datepicker.one('transitionend.dp', event.bind(this, this, true))
            },

            _changeView: function (date, dir) {
                date = date || this.focused || this.date;

                let nextView = dir == 'up' ? this.viewIndex + 1 : this.viewIndex - 1;
                if (nextView > 2) nextView = 2;
                if (nextView < 0) nextView = 0;

                this.silent = true;
                // this.date = new Date(date.getFullYear(), date.getMonth(), 1);
                this.date = date.date(1);
                this.silent = false;
                this.view = this.viewIndexes[nextView];
            },

            _handleHotKey: function (key) {
                let date = datepicker.getParsedDate(this._getFocusedDate()),
                    focusedParsed,
                    o = this.opts,
                    newDate,
                    totalDaysInNextMonth,
                    monthChanged = false,
                    yearChanged = false,
                    decadeChanged = false,
                    y = date.year,
                    m = date.month,
                    d = date.date;

                switch (key) {
                    case 'ctrlRight':
                    case 'ctrlUp':
                        m += 1;
                        monthChanged = true;
                        break;
                    case 'ctrlLeft':
                    case 'ctrlDown':
                        m -= 1;
                        monthChanged = true;
                        break;
                    case 'shiftRight':
                    case 'shiftUp':
                        yearChanged = true;
                        y += 1;
                        break;
                    case 'shiftLeft':
                    case 'shiftDown':
                        yearChanged = true;
                        y -= 1;
                        break;
                    case 'altRight':
                    case 'altUp':
                        decadeChanged = true;
                        y += 10;
                        break;
                    case 'altLeft':
                    case 'altDown':
                        decadeChanged = true;
                        y -= 10;
                        break;
                    case 'ctrlShiftUp':
                        this.up();
                        break;
                }

                newDate = this.getNewDate(y, m, d);
                totalDaysInNextMonth = datepicker.getDaysCount(newDate);

                // If next month has less days than current, set date to total days in that month
                if (totalDaysInNextMonth < d) d = totalDaysInNextMonth;

                // Check if newDate is in valid range
                if (newDate.valueOf() < this.minTime) {
                    newDate = this.minDate;
                } else if (newDate.valueOf() > this.maxTime) {
                    newDate = this.maxDate;
                }

                this.focused = newDate;

                focusedParsed = datepicker.getParsedDate(newDate);
                if (monthChanged && o.onChangeMonth) {
                    o.onChangeMonth(focusedParsed.month, focusedParsed.year)
                }
                if (yearChanged && o.onChangeYear) {
                    o.onChangeYear(focusedParsed.year)
                }
                if (decadeChanged && o.onChangeDecade) {
                    o.onChangeDecade(this.curDecade)
                }
            },

            _registerKey: function (key) {
                let exists = this.keys.some(function (curKey) {
                    return curKey == key;
                });

                if (!exists) {
                    this.keys.push(key)
                }
            },

            _unRegisterKey: function (key) {
                let index = this.keys.indexOf(key);

                this.keys.splice(index, 1);
            },

            _isHotKeyPressed: function () {
                let currentHotKey,
                    found = false,
                    _this = this,
                    pressedKeys = this.keys.sort();

                for (let hotKey in hotKeys) {
                    currentHotKey = hotKeys[hotKey];
                    if (pressedKeys.length != currentHotKey.length) continue;

                    if (currentHotKey.every(function (key, i) {
                        return key == pressedKeys[i]
                    })) {
                        _this._trigger('hotKey', hotKey);
                        found = true;
                    }
                }

                return found;
            },

            _trigger: function (event, args) {
                this.$el.trigger(event, args)
            },

            _focusNextCell: function (keyCode, type) {
                type = type || this.cellType;

                let date = datepicker.getParsedDate(this._getFocusedDate()),
                    y = date.year,
                    m = date.month,
                    d = date.date;

                if (this._isHotKeyPressed()) {
                    return;
                }

                switch (keyCode) {
                    case 37: // left
                        type == 'day' ? (d -= 1) : '';
                        type == 'month' ? (m -= 1) : '';
                        type == 'year' ? (y -= 1) : '';
                        break;
                    case 38: // up
                        type == 'day' ? (d -= 7) : '';
                        type == 'month' ? (m -= 3) : '';
                        type == 'year' ? (y -= 4) : '';
                        break;
                    case 39: // right
                        type == 'day' ? (d += 1) : '';
                        type == 'month' ? (m += 1) : '';
                        type == 'year' ? (y += 1) : '';
                        break;
                    case 40: // down
                        type == 'day' ? (d += 7) : '';
                        type == 'month' ? (m += 3) : '';
                        type == 'year' ? (y += 4) : '';
                        break;
                }

                // let nd = new Date(y, m, d);
                let nd = this.getNewDate(y, m, d);

                if (nd.valueOf() < this.minTime) {
                    nd = this.minDate;
                } else if (nd.valueOf() > this.maxTime) {
                    nd = this.maxDate;
                }

                this.focused = nd;
            },

            _getFocusedDate: function () {
                let focused = this.focused || this.selectedDates[this.selectedDates.length - 1],
                    d = this.parsedDate;

                if (!focused) {
                    switch (this.view) {
                        case 'days':
                            // focused = new Date(d.year, d.month, new Date().getDate());
                            focused = this.getNewDate(d.year, d.month, this.now.date());
                            break;
                        case 'months':
                            // focused = new Date(d.year, d.month, 1);
                            focused = this.getNewDate(d.year, d.month, 1);
                            break;
                        case 'years':
                            // focused = new Date(d.year, 0, 1);
                            focused = this.getNewDate(d.year, 0, 1);
                            break;
                    }
                }

                return focused;
            },

            _getCell: function (date, type) {
                type = type || this.cellType;

                let d = datepicker.getParsedDate(date),
                    selector = '.datepicker--cell[data-year="' + d.year + '"]',
                    $cell;

                switch (type) {
                    case 'month':
                        selector = '[data-month="' + d.month + '"]';
                        break;
                    case 'day':
                        selector += '[data-month="' + d.month + '"][data-date="' + d.date + '"]';
                        break;
                }
                $cell = this.views[this.currentView].$el.find(selector);

                return $cell.length ? $cell : $('');
            },

            destroy: function () {
                let _this = this;
                _this.$el
                    .off('.adp')
                    .data('datepicker', '');

                _this.selectedDates = [];
                _this.focused = '';
                _this.views = {};
                _this.keys = [];
                _this.minRange = '';
                _this.maxRange = '';

                if (_this.opts.inline || !_this.elIsInput) {
                    _this.$datepicker.closest('.datepicker-inline').remove();
                } else {
                    _this.$datepicker.remove();
                }
            },

            _isValidDateFormat: function (str) {
                if (this.loc.dateFormatRegx) {
                    let regx = new RegExp('^' + this.loc.dateFormatRegx + '$');
                    return regx.test(str);
                }

                return true;
            },

            _handleAlreadySelectedDates: function (alreadySelected, selectedDate) {
                if (this.opts.range) {
                    if (!this.opts.toggleSelected) {
                        // Add possibility to select same date when range is true
                        if (this.selectedDates.length != 2) {
                            this._trigger('clickCell', selectedDate);
                        }
                    } else {
                        this.removeDate(selectedDate);
                    }
                } else if (this.opts.toggleSelected) {
                    this.removeDate(selectedDate);
                }

                // Change last selected date to be able to change time when clicking on this cell
                if (!this.opts.toggleSelected) {
                    this.lastSelectedDate = alreadySelected;
                    if (this.opts.timepicker) {
                        this.timepicker._setTime(alreadySelected);
                        this.timepicker.update();
                    }
                }
            },

            _onShowEvent: function (e) {
                if (!this.visible) {
                    this.show();
                }
            },

            _onBlur: function () {
                if (!this.inFocus && this.visible) {
                    this.hide();
                }
            },

            _onMouseDownDatepicker: function (e) {
                this.inFocus = true;
            },

            _onMouseUpDatepicker: function (e) {
                this.inFocus = false;
                e.originalEvent.inFocus = true;
                if (!e.originalEvent.timepickerFocus) this.$el.focus();
            },

            _onKeyUpGeneral: function (e) {
                let val = this.$el.val();

                if (!val) {
                    this.clear();
                }
            },

            _onResize: function () {
                if (this.visible) {
                    this.setPosition();
                }
            },

            _onMouseUpBody: function (e) {
                if (e.originalEvent.inFocus) return;

                if (this.visible && !this.inFocus) {
                    this.hide();
                }
            },

            _onMouseUpEl: function (e) {
                e.originalEvent.inFocus = true;
                setTimeout(this._onKeyUpGeneral.bind(this), 4);
            },

            _onKeyDown: function (e) {
                let _this = this;
                let code = e.which,
                    key = e.key;

                this._registerKey(code);

                // Enter
                if (code == 13) {

                    if (this.focused) {
                        if (this._getCell(this.focused).hasClass('-disabled-')) return;
                        if (this.view != this.opts.minView) {
                            this.down()
                        } else {
                            let alreadySelected = this._isSelected(this.focused, this.cellType);

                            if (!alreadySelected) {
                                if (this.timepicker) {
                                    this.focused.hours(this.timepicker.hours);
                                    this.focused.minutes(this.timepicker.minutes);
                                }
                                this.selectDate(this.focused);
                                return;
                            }
                            this._handleAlreadySelectedDates(alreadySelected, this.focused)
                        }
                    }

                // Esc
                } else if (code == 27) {

                    this.hide();

                // Arrows
                } else if (code >= 37 && code <= 40) {

                    if (!_this.opts.manualInput) {
                        e.preventDefault();
                        this._focusNextCell(code);
                    }

                } else if (key.match(manualInputKeyRegx) || [8,45,46].includes(code)) {

                    clearTimeout(_this.manualInputTimer);
                    _this.manualInputTimer = setTimeout(() => {

                        let date = _this.$el.val();
                        if (_this._isValidDateFormat(date)) {
                            let mDate = moment.tz(date, _this.loc.dateFormat, _this.opts.timeZoneView);
                            if (mDate.isValid()) {
                                _this.selectDate(mDate);
                                console.log(mDate.format())
                                _this.$el.removeClass(invalidDateClass);
                            } else {
                                _this.$el.addClass(invalidDateClass);
                                console.warn('Date is invalid', mDate);
                            }
                        } else {
                            _this.$el.addClass(invalidDateClass);
                            console.warn('Date format is invalid');
                        }

                    }, 700);

                } else {
                    e.preventDefault();
                }

            },

            _onKeyUp: function (e) {
                let code = e.which;
                this._unRegisterKey(code);
            },

            _onHotKey: function (e, hotKey) {
                this._handleHotKey(hotKey);
            },

            _onMouseEnterCell: function (e) {
                let $cell = $(e.target).closest('.datepicker--cell'),
                    date = this._getDateFromCell($cell);

                // Prevent from unnecessary rendering and setting new currentDate
                this.silent = true;

                if (this.focused) {
                    this.focused = ''
                }

                $cell.addClass('-focus-');

                this.focused = date;
                this.silent = false;

                if (this.opts.range && this.selectedDates.length == 1) {
                    this.minRange = this.selectedDates[0];
                    this.maxRange = '';
                    if (datepicker.less(this.minRange, this.focused)) {
                        this.maxRange = this.minRange;
                        this.minRange = '';
                    }
                    this.views[this.currentView]._update();
                }
            },

            _onMouseLeaveCell: function (e) {
                let $cell = $(e.target).closest('.datepicker--cell');

                $cell.removeClass('-focus-');

                this.silent = true;
                this.focused = '';
                this.silent = false;
            },

            _onTimeChange: function (e, h, m) {
                let date = this.date,
                    selectedDates = this.selectedDates,
                    selected = false;

                if (selectedDates.length) {
                    selected = true;
                    date = this.lastSelectedDate;
                }

                date.hours(h);
                date.minutes(m);

                if (!selected && !this._getCell(date).hasClass('-disabled-')) {
                    this.selectDate(date);
                } else {
                    this._setInputValue();
                    if (this.opts.onSelect) {
                        this._triggerOnChange();
                    }
                }
            },

            _onClickCell: function (e, date) {
                if (this.timepicker) {
                    date.hours(this.timepicker.hours);
                    date.minutes(this.timepicker.minutes);
                }
                this.selectDate(date);
            },

            getNewDate: function () {
                // console.log(arguments);
                return arguments.length
                    ? moment.tz([...arguments], this.opts.timeZoneView)
                    : moment.tz(this.opts.timeZoneView);
            },

            set focused(val) {
                if (!val && this.focused) {
                    let $cell = this._getCell(this.focused);

                    if ($cell.length) {
                        $cell.removeClass('-focus-')
                    }
                }
                this._focused = val;
                if (this.opts.range && this.selectedDates.length == 1) {
                    this.minRange = this.selectedDates[0];
                    this.maxRange = '';
                    if (datepicker.less(this.minRange, this._focused)) {
                        this.maxRange = this.minRange;
                        this.minRange = '';
                    }
                }
                if (this.silent) return;
                this.date = val;
            },

            get focused() {
                return this._focused;
            },

            get parsedDate() {
                return datepicker.getParsedDate(this.date);
            },

            set date(val) {
                if (!(val instanceof moment)) return;

                this.currentDate = val;

                if (this.inited && !this.silent) {
                    this.views[this.view]._render();
                    this.nav._render();
                    if (this.visible && this.elIsInput) {
                        this.setPosition();
                    }
                }
                return val;
            },

            get date() {
                return this.currentDate
            },

            get now() {
                return moment.tz(this.opts.timeZoneView);
            },

            set view(val) {
                this.viewIndex = this.viewIndexes.indexOf(val);

                if (this.viewIndex < 0) {
                    return;
                }

                this.prevView = this.currentView;
                this.currentView = val;

                if (this.inited) {
                    if (!this.views[val]) {
                        this.views[val] = new $.fn.datepicker.Body(this, val, this.opts)
                    } else {
                        this.views[val]._render();
                    }

                    this.views[this.prevView].hide();
                    this.views[val].show();
                    this.nav._render();

                    if (this.opts.onChangeView) {
                        this.opts.onChangeView(val)
                    }
                    if (this.elIsInput && this.visible) this.setPosition();
                }

                return val
            },

            get view() {
                return this.currentView;
            },

            get cellType() {
                return this.view.substring(0, this.view.length - 1)
            },

            get minTime() {
                let min = this.minDate.clone();
                return min.valueOf();
            },

            get maxTime() {
                let max = this.maxDate.clone();
                return max.valueOf();
            },

            get curDecade() {
                return datepicker.getDecade(this.date)
            }
        };

        //  Utils
        // -------------------------------------------------

        /**
         * @param date moment
         * @returns {int}
         */
        datepicker.getDaysCount = function (date) {
            // return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
            return date.daysInMonth();
        };

        /**
         * @param date moment
         * @returns {{date: *, hours: *, fullDate: string, month: *, fullHours: string, year: *, minutes: *, fullMonth: string, day: *, fullMinutes: string}}
         */
        datepicker.getParsedDate = function (date) {
            return {
                year: date.year(),
                month: date.month(),
                fullMonth: (date.month() + 1) < 10 ? '0' + (date.month() + 1) : date.month() + 1, // One based
                date: date.date(),
                fullDate: date.date() < 10 ? '0' + date.date() : date.date(),
                day: date.day(),
                hours: date.hour(),
                fullHours: date.hour() < 10 ? '0' + date.hour() : date.hour(),
                minutes: date.minutes(),
                fullMinutes: date.minutes() < 10 ? '0' + date.minutes() : date.minutes()
            }
        };

        datepicker.getDecade = function (date) {
            let firstYear = Math.floor(date.year() / 10) * 10;

            return [firstYear, firstYear + 9];
        };

        datepicker.template = function (str, data) {
            return str.replace(/#\{([\w]+)\}/g, function (source, match) {
                if (data[match] || data[match] === 0) {
                    return data[match]
                }
            });
        };

        datepicker.isSame = function (date1, date2, type) {
            if (!date1 || !date2) return false;
            let d1 = datepicker.getParsedDate(date1),
                d2 = datepicker.getParsedDate(date2),
                _type = type ? type : 'day',

                conditions = {
                    day: d1.date == d2.date && d1.month == d2.month && d1.year == d2.year,
                    month: d1.month == d2.month && d1.year == d2.year,
                    year: d1.year == d2.year
                };

            return conditions[_type];
        };

        datepicker.less = function (dateCompareTo, date, type) {
            if (!dateCompareTo || !date) return false;
            return date.valueOf() < dateCompareTo.valueOf();
        };

        datepicker.bigger = function (dateCompareTo, date, type) {
            if (!dateCompareTo || !date) return false;
            return date.valueOf() > dateCompareTo.valueOf();
        };

        datepicker.getLeadingZeroNum = function (num) {
            return parseInt(num) < 10 ? '0' + num : num;
        };

        /**
         * Returns copy of date with hours and minutes equals to 0
         * @param date {Date}
         */
        datepicker.resetTime = function (date) {
            if (typeof date != 'object') return;
            date = datepicker.getParsedDate(date);
            return datepicker.getNewDate(date.year, date.month, date.date)
        };

        $.fn.datepicker = function (options) {
            return this.each(function () {
                if (!$.data(this, pluginName)) {
                    $.data(this, pluginName,
                        new Datepicker(this, options));
                } else {
                    let _this = $.data(this, pluginName);

                    _this.opts = $.extend(true, _this.opts, options);
                    _this.update();
                }
            });
        };

        $.fn.datepicker.Constructor = Datepicker;

        $.fn.datepicker.language = {
            en: {
                days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                daysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                daysMin: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
                months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                today: 'Today',
                clear: 'Clear',
                dateFormat: 'D MMMM YYYY',
                dateFormatRegx: '\\d{1,2} [a-zA-Z]{3,} \\d{4}',
                timeFormat: 'h:mm a',
                timeFormatRegx: '\\d{1,2}:\\d{2} (am|pm)',
                firstDay: 0
            }
        };

        $(function () {
            $(autoInitSelector).datepicker();
        })

    })();

    ;(function () {
        let templates = {
                days: '' +
                    '<div class="datepicker--days datepicker--body">' +
                    '<div class="datepicker--days-names"></div>' +
                    '<div class="datepicker--cells datepicker--cells-days"></div>' +
                    '</div>',
                months: '' +
                    '<div class="datepicker--months datepicker--body">' +
                    '<div class="datepicker--cells datepicker--cells-months"></div>' +
                    '</div>',
                years: '' +
                    '<div class="datepicker--years datepicker--body">' +
                    '<div class="datepicker--cells datepicker--cells-years"></div>' +
                    '</div>'
            },
            datepicker = $.fn.datepicker,
            dp = datepicker.Constructor;

        /**
         * @param d Datepicker
         * @param type
         * @param opts
         * @constructor
         */
        datepicker.Body = function (d, type, opts) {
            this.d = d;
            this.type = type;
            this.opts = opts;
            this.$el = $('');

            if (this.opts.onlyTimepicker) return;
            this.init();
        };

        datepicker.Body.prototype = {
            init: function () {
                this._buildBaseHtml();
                this._render();

                this._bindEvents();
            },

            _bindEvents: function () {
                this.$el.on('click', '.datepicker--cell', $.proxy(this._onClickCell, this));
            },

            _buildBaseHtml: function () {
                this.$el = $(templates[this.type]).appendTo(this.d.$content);
                this.$names = $('.datepicker--days-names', this.$el);
                this.$cells = $('.datepicker--cells', this.$el);
            },

            _getDayNamesHtml: function (firstDay, curDay, html, i) {
                curDay = curDay != undefined ? curDay : firstDay;
                html = html ? html : '';
                i = i != undefined ? i : 0;

                if (i > 7) return html;
                if (curDay == 7) return this._getDayNamesHtml(firstDay, 0, html, ++i);

                html += '<div class="datepicker--day-name' + (this.d.isWeekend(curDay) ? " -weekend-" : "") + '">' + this.d.loc.daysMin[curDay] + '</div>';

                return this._getDayNamesHtml(firstDay, ++curDay, html, ++i);
            },

            /**
             * @param date moment
             * @param type string
             * @returns {{classes: string, html: *}}
             * @private
             */
            _getCellContents: function (date, type) {
                let classes = "datepicker--cell datepicker--cell-" + type,
                    parent = this.d,
                    currentDate = moment.tz(parent.opts.timeZoneView),
                    minRange = dp.resetTime(parent.minRange),
                    maxRange = dp.resetTime(parent.maxRange),
                    opts = parent.opts,
                    d = dp.getParsedDate(date),
                    render = {},
                    html = d.date;

                switch (type) {
                    case 'day':
                        if (parent.isWeekend(d.day)) classes += " -weekend-";
                        if (d.month != this.d.parsedDate.month) {
                            classes += " -other-month-";
                            if (!opts.selectOtherMonths) {
                                classes += " -disabled-";
                            }
                            if (!opts.showOtherMonths) html = '';
                        }
                        break;
                    case 'month':
                        html = parent.loc[parent.opts.monthsField][d.month];
                        break;
                    case 'year':
                        let decade = parent.curDecade;
                        html = d.year;
                        if (d.year < decade[0] || d.year > decade[1]) {
                            classes += ' -other-decade-';
                            if (!opts.selectOtherYears) {
                                classes += " -disabled-";
                            }
                            if (!opts.showOtherYears) html = '';
                        }
                        break;
                }

                if (opts.onRenderCell) {
                    render = opts.onRenderCell(date, type) || {};
                    html = render.html ? render.html : html;
                    classes += render.classes ? ' ' + render.classes : '';
                }

                if (opts.range) {
                    if (dp.isSame(minRange, date, type)) classes += ' -range-from-';
                    if (dp.isSame(maxRange, date, type)) classes += ' -range-to-';

                    if (parent.selectedDates.length == 1 && parent.focused) {
                        if (
                            (dp.bigger(minRange, date) && dp.less(parent.focused, date)) ||
                            (dp.less(maxRange, date) && dp.bigger(parent.focused, date))) {
                            classes += ' -in-range-'
                        }

                        if (dp.less(maxRange, date) && dp.isSame(parent.focused, date)) {
                            classes += ' -range-from-'
                        }
                        if (dp.bigger(minRange, date) && dp.isSame(parent.focused, date)) {
                            classes += ' -range-to-'
                        }

                    } else if (parent.selectedDates.length == 2) {
                        if (dp.bigger(minRange, date) && dp.less(maxRange, date)) {
                            classes += ' -in-range-'
                        }
                    }
                }


                if (dp.isSame(currentDate, date, type)) classes += ' -current-';
                if (parent.focused && dp.isSame(date, parent.focused, type)) classes += ' -focus-';
                if (parent._isSelected(date, type)) classes += ' -selected-';
                if (!parent._isInRange(date, type) || render.disabled) classes += ' -disabled-';

                return {
                    html: html,
                    classes: classes
                }
            },

            /**
             * Calculates days number to render. Generates days html and returns it.
             * @param date moment
             * @returns {string|string}
             * @private
             */
            _getDaysHtml: function (date) {
                let totalMonthDays = dp.getDaysCount(date),
                    firstMonthDay = date.clone().date(1).day(),
                    lastMonthDay = date.clone().date(totalMonthDays).day(),
                    daysFromPevMonth = firstMonthDay - this.d.loc.firstDay,
                    daysFromNextMonth = 6 - lastMonthDay + this.d.loc.firstDay;

                daysFromPevMonth = daysFromPevMonth < 0 ? daysFromPevMonth + 7 : daysFromPevMonth;
                daysFromNextMonth = daysFromNextMonth > 6 ? daysFromNextMonth - 7 : daysFromNextMonth;

                let startDayIndex = -daysFromPevMonth + 1,
                    html = '';

                for (let i = startDayIndex, max = totalMonthDays + daysFromNextMonth; i <= max; i++) {
                    html += this._getDayHtml(date.clone().date(i))
                }

                return html;
            },

            /**
             * @param date moment
             * @returns {string}
             * @private
             */
            _getDayHtml: function (date) {
                let content = this._getCellContents(date, 'day');

                return '<div class="' + content.classes + '" ' +
                    'data-date="' + date.date() + '" ' +
                    'data-month="' + date.month() + '" ' +
                    'data-year="' + date.year() + '">' + content.html + '</div>';
            },

            /**
             * Generates months html
             * @param {object} date - date instance
             * @returns {string}
             * @private
             */
            _getMonthsHtml: function (date) {
                let html = '',
                    d = dp.getParsedDate(date),
                    i = 0;

                while (i < 12) {
                    html += this._getMonthHtml(this.d.getNewDate(d.year, i));
                    i++
                }

                return html;
            },

            _getMonthHtml: function (date) {
                let content = this._getCellContents(date, 'month');

                return '<div class="' + content.classes + '" data-month="' + date.month() + '">' + content.html + '</div>'
            },

            _getYearsHtml: function (date) {
                let decade = dp.getDecade(date),
                    firstYear = decade[0] - 1,
                    html = '',
                    i = firstYear;

                for (i; i <= decade[1] + 1; i++) {
                    html += this._getYearHtml(this.d.getNewDate(i, 0));
                }

                return html;
            },

            _getYearHtml: function (date) {
                let content = this._getCellContents(date, 'year');

                return '<div class="' + content.classes + '" data-year="' + date.year() + '">' + content.html + '</div>'
            },

            _renderTypes: {
                days: function () {
                    let dayNames = this._getDayNamesHtml(this.d.loc.firstDay),
                        days = this._getDaysHtml(this.d.currentDate);

                    this.$cells.html(days);
                    this.$names.html(dayNames)
                },
                months: function () {
                    let html = this._getMonthsHtml(this.d.currentDate);

                    this.$cells.html(html)
                },
                years: function () {
                    let html = this._getYearsHtml(this.d.currentDate);

                    this.$cells.html(html)
                }
            },

            _render: function () {
                if (this.opts.onlyTimepicker) return;
                this._renderTypes[this.type].bind(this)();
            },

            _update: function () {
                let $cells = $('.datepicker--cell', this.$cells),
                    _this = this,
                    classes,
                    $cell,
                    date;
                $cells.each(function (cell, i) {
                    $cell = $(this);
                    date = _this.d._getDateFromCell($(this));
                    classes = _this._getCellContents(date, _this.d.cellType);
                    $cell.attr('class', classes.classes)
                });
            },

            show: function () {
                if (this.opts.onlyTimepicker) return;
                this.$el.addClass('active');
                this.acitve = true;
            },

            hide: function () {
                this.$el.removeClass('active');
                this.active = false;
            },

            //  Events
            // -------------------------------------------------

            _handleClick: function (el) {
                let date = el.data('date') || 1,
                    month = el.data('month') || 0,
                    year = el.data('year') || this.d.parsedDate.year,
                    dp = this.d;
                // Change view if min view does not reach yet
                if (dp.view != this.opts.minView) {
                    dp.down(dp.getNewDate(year, month, date));
                    return;
                }
                // Select date if min view is reached
                let selectedDate = dp.getNewDate(year, month, date),
                    alreadySelected = this.d._isSelected(selectedDate, this.d.cellType);

                if (!alreadySelected) {
                    dp._trigger('clickCell', selectedDate);
                    return;
                }

                dp._handleAlreadySelectedDates.bind(dp, alreadySelected, selectedDate)();

            },

            _onClickCell: function (e) {
                let $el = $(e.target).closest('.datepicker--cell');

                if ($el.hasClass('-disabled-')) return;

                this._handleClick.bind(this)($el);
            }
        };
    })();

    ;(function () {
        let template = '' +
            '<div class="datepicker--nav-action" data-action="prev">#{prevHtml}</div>' +
            '<div class="datepicker--nav-title">#{title}</div>' +
            '<div class="datepicker--nav-action" data-action="next">#{nextHtml}</div>',
            buttonsContainerTemplate = '<div class="datepicker--buttons"></div>',
            button = '<span class="datepicker--button" data-action="#{action}">#{label}</span>',
            datepicker = $.fn.datepicker,
            dp = datepicker.Constructor;

        datepicker.Navigation = function (d, opts) {
            this.d = d;
            this.opts = opts;

            this.$buttonsContainer = '';

            this.init();
        };

        datepicker.Navigation.prototype = {
            init: function () {
                this._buildBaseHtml();
                this._bindEvents();
            },

            _bindEvents: function () {
                this.d.$nav.on('click', '.datepicker--nav-action', $.proxy(this._onClickNavButton, this));
                this.d.$nav.on('click', '.datepicker--nav-title', $.proxy(this._onClickNavTitle, this));
                this.d.$datepicker.on('click', '.datepicker--button', $.proxy(this._onClickNavButton, this));
            },

            _buildBaseHtml: function () {
                if (!this.opts.onlyTimepicker) {
                    this._render();
                }
                this._addButtonsIfNeed();
            },

            _addButtonsIfNeed: function () {
                if (this.opts.todayButton) {
                    this._addButton('today')
                }
                if (this.opts.clearButton) {
                    this._addButton('clear')
                }
            },

            _render: function () {
                let title = this._getTitle(this.d.currentDate),
                    html = dp.template(template, $.extend({title: title}, this.opts));
                this.d.$nav.html(html);
                if (this.d.view == 'years') {
                    $('.datepicker--nav-title', this.d.$nav).addClass('-disabled-');
                }
                this.setNavStatus();
            },

            _getTitle: function (date) {
                if (this.d.view == 'years') {
                    let decade = dp.getDecade(date);
                    return decade[0] + ' – ' + decade[1];
                }
                return date.format(this.opts.navTitles[this.d.view]);
            },

            _addButton: function (type) {
                if (!this.$buttonsContainer.length) {
                    this._addButtonsContainer();
                }

                let data = {
                        action: type,
                        label: this.d.loc[type]
                    },
                    html = dp.template(button, data);

                if ($('[data-action=' + type + ']', this.$buttonsContainer).length) return;
                this.$buttonsContainer.append(html);
            },

            _addButtonsContainer: function () {
                this.d.$datepicker.append(buttonsContainerTemplate);
                this.$buttonsContainer = $('.datepicker--buttons', this.d.$datepicker);
            },

            setNavStatus: function () {
                if (!(this.opts.minDate || this.opts.maxDate) || !this.opts.disableNavWhenOutOfRange) return;

                let date = this.d.parsedDate,
                    m = date.month,
                    y = date.year,
                    d = date.date;

                switch (this.d.view) {
                    case 'days':
                        if (!this.d._isInRange(this.getNewDate(y, m - 1, 1), 'month')) {
                            this._disableNav('prev')
                        }
                        if (!this.d._isInRange(this.getNewDate(y, m + 1, 1), 'month')) {
                            this._disableNav('next')
                        }
                        break;
                    case 'months':
                        if (!this.d._isInRange(this.getNewDate(y - 1, m, d), 'year')) {
                            this._disableNav('prev')
                        }
                        if (!this.d._isInRange(this.getNewDate(y + 1, m, d), 'year')) {
                            this._disableNav('next')
                        }
                        break;
                    case 'years':
                        let decade = dp.getDecade(this.d.date);
                        if (!this.d._isInRange(this.getNewDate(decade[0] - 1, 0, 1), 'year')) {
                            this._disableNav('prev')
                        }
                        if (!this.d._isInRange(this.getNewDate(decade[1] + 1, 0, 1), 'year')) {
                            this._disableNav('next')
                        }
                        break;
                }
            },

            _disableNav: function (nav) {
                $('[data-action="' + nav + '"]', this.d.$nav).addClass('-disabled-')
            },

            _activateNav: function (nav) {
                $('[data-action="' + nav + '"]', this.d.$nav).removeClass('-disabled-')
            },

            _onClickNavButton: function (e) {
                let $el = $(e.target).closest('[data-action]'),
                    action = $el.data('action');

                this.d[action]();
            },

            _onClickNavTitle: function (e) {
                if ($(e.target).hasClass('-disabled-')) return;

                if (this.d.view == 'days') {
                    return this.d.view = 'months'
                }

                this.d.view = 'years';
            }
        }

    })();

    ;(function () {
        let template = '<div class="datepicker--time">' +
            '<div class="datepicker--time-current">' +
            '   <span class="datepicker--time-current-hours">#{hourVisible}</span>' +
            '   <span class="datepicker--time-current-colon">:</span>' +
            '   <span class="datepicker--time-current-minutes">#{minValue}</span>' +
            '</div>' +
            '<div class="datepicker--time-sliders">' +
            '   <div class="datepicker--time-row">' +
            '      <input type="range" name="hours" value="#{hourValue}" min="#{hourMin}" max="#{hourMax}" step="#{hourStep}"/>' +
            '   </div>' +
            '   <div class="datepicker--time-row">' +
            '      <input type="range" name="minutes" value="#{minValue}" min="#{minMin}" max="#{minMax}" step="#{minStep}"/>' +
            '   </div>' +
            '</div>' +
            '</div>',
            datepicker = $.fn.datepicker,
            dp = datepicker.Constructor;

        datepicker.Timepicker = function (inst, opts) {
            this.d = inst;
            this.opts = opts;

            this.init();
        };

        datepicker.Timepicker.prototype = {
            init: function () {
                let input = 'input';
                this._setTime(this.d.date);
                this._buildHTML();

                if (navigator.userAgent.match(/trident/gi)) {
                    input = 'change';
                }

                this.d.$el.on('selectDate', this._onSelectDate.bind(this));
                this.$ranges.on(input, this._onChangeRange.bind(this));
                this.$ranges.on('mouseup', this._onMouseUpRange.bind(this));
                this.$ranges.on('mousemove focus ', this._onMouseEnterRange.bind(this));
                this.$ranges.on('mouseout blur', this._onMouseOutRange.bind(this));
            },

            /**
             * @param date moment
             * @private
             */
            _setTime: function (date) {
                let _date = dp.getParsedDate(date);

                this._handleDate(date);
                this.hours = _date.hours < this.minHours ? this.minHours : _date.hours;
                this.minutes = _date.minutes < this.minMinutes ? this.minMinutes : _date.minutes;
            },

            /**
             * Sets minHours and minMinutes from date (usually it's a minDate)
             * Also changes minMinutes if current hours are bigger then @date hours
             * @param date moment
             * @private
             */
            _setMinTimeFromDate: function (date) {
                this.minHours = date.hours();
                this.minMinutes = date.minutes();

                // If, for example, min hours are 10, and current hours are 12,
                // update minMinutes to default value, to be able to choose whole range of values
                if (this.d.lastSelectedDate) {
                    if (this.d.lastSelectedDate.hours() > date.hours()) {
                        this.minMinutes = this.opts.minMinutes;
                    }
                }
            },

            /**
             * @param date moment
             * @private
             */
            _setMaxTimeFromDate: function (date) {
                this.maxHours = date.hours();
                this.maxMinutes = date.minutes();

                if (this.d.lastSelectedDate) {
                    if (this.d.lastSelectedDate.hours() < date.hours()) {
                        this.maxMinutes = this.opts.maxMinutes;
                    }
                }
            },

            _setDefaultMinMaxTime: function () {
                let maxHours = 23,
                    maxMinutes = 59,
                    opts = this.opts;

                this.minHours = opts.minHours < 0 || opts.minHours > maxHours ? 0 : opts.minHours;
                this.minMinutes = opts.minMinutes < 0 || opts.minMinutes > maxMinutes ? 0 : opts.minMinutes;
                this.maxHours = opts.maxHours < 0 || opts.maxHours > maxHours ? maxHours : opts.maxHours;
                this.maxMinutes = opts.maxMinutes < 0 || opts.maxMinutes > maxMinutes ? maxMinutes : opts.maxMinutes;
            },

            /**
             * Looks for min/max hours/minutes and if current values
             * are out of range sets valid values.
             * @param date moment
             * @private
             */
            _validateHoursMinutes: function (date) {
                if (this.hours < this.minHours) {
                    this.hours = this.minHours;
                } else if (this.hours > this.maxHours) {
                    this.hours = this.maxHours;
                }

                if (this.minutes < this.minMinutes) {
                    this.minutes = this.minMinutes;
                } else if (this.minutes > this.maxMinutes) {
                    this.minutes = this.maxMinutes;
                }
            },

            _buildHTML: function () {
                let lz = dp.getLeadingZeroNum,
                    data = {
                        hourMin: this.minHours,
                        hourMax: lz(this.maxHours),
                        hourStep: this.opts.hoursStep,
                        hourValue: this.hours,
                        hourVisible: lz(this.displayHours),
                        minMin: this.minMinutes,
                        minMax: lz(this.maxMinutes),
                        minStep: this.opts.minutesStep,
                        minValue: lz(this.minutes)
                    },
                    _template = dp.template(template, data);

                this.$timepicker = $(_template).appendTo(this.d.$datepicker);
                this.$ranges = $('[type="range"]', this.$timepicker);
                this.$hours = $('[name="hours"]', this.$timepicker);
                this.$minutes = $('[name="minutes"]', this.$timepicker);
                this.$hoursText = $('.datepicker--time-current-hours', this.$timepicker);
                this.$minutesText = $('.datepicker--time-current-minutes', this.$timepicker);

                if (this.d.ampm) {
                    this.$ampm = $('<span class="datepicker--time-current-ampm">')
                        .appendTo($('.datepicker--time-current', this.$timepicker))
                        .html(this.dayPeriod);

                    this.$timepicker.addClass('-am-pm-');
                }
            },

            _updateCurrentTime: function () {
                let h = dp.getLeadingZeroNum(this.displayHours),
                    m = dp.getLeadingZeroNum(this.minutes);

                this.$hoursText.html(h);
                this.$minutesText.html(m);

                if (this.d.ampm) {
                    this.$ampm.html(this.dayPeriod);
                }
            },

            _updateRanges: function () {
                this.$hours.attr({
                    min: this.minHours,
                    max: this.maxHours
                }).val(this.hours);

                this.$minutes.attr({
                    min: this.minMinutes,
                    max: this.maxMinutes
                }).val(this.minutes)
            },

            /**
             * Sets minHours, minMinutes etc. from date. If date is not passed, than sets
             * values from options
             * @param [date] {object} - Date object, to get values from
             * @private
             */
            _handleDate: function (date) {
                this._setDefaultMinMaxTime();

                if (date) {
                    if (dp.isSame(date, this.d.opts.minDate)) {
                        this._setMinTimeFromDate(this.d.opts.minDate);
                    } else if (dp.isSame(date, this.d.opts.maxDate)) {
                        this._setMaxTimeFromDate(this.d.opts.maxDate);
                    }
                }

                this._validateHoursMinutes(date);
            },

            update: function () {
                this._updateRanges();
                this._updateCurrentTime();
            },

            /**
             * Calculates valid hour value to display in text input and datepicker's body.
             * @param date {Date|Number} - date or hours
             * @param [ampm] {Boolean} - 12 hours mode
             * @returns {{hours: *, dayPeriod: string}}
             * @private
             */
            _getValidHoursFromDate: function (date, ampm) {
                let d = date,
                    hours = date;

                if (date instanceof Date) {
                    d = dp.getParsedDate(date);
                    hours = d.hours;
                }

                let _ampm = ampm || this.d.ampm,
                    dayPeriod = 'am';

                if (_ampm) {
                    switch (true) {
                        case hours == 0:
                            hours = 12;
                            break;
                        case hours == 12:
                            dayPeriod = 'pm';
                            break;
                        case hours > 11:
                            hours = hours - 12;
                            dayPeriod = 'pm';
                            break;
                        default:
                            break;
                    }
                }

                return {
                    hours: hours,
                    dayPeriod: dayPeriod
                }
            },

            set hours(val) {
                this._hours = val;

                let displayHours = this._getValidHoursFromDate(val);

                this.displayHours = displayHours.hours;
                this.dayPeriod = displayHours.dayPeriod;
            },

            get hours() {
                return this._hours;
            },

            //  Events
            // -------------------------------------------------

            _onChangeRange: function (e) {
                let $target = $(e.target),
                    name = $target.attr('name');

                this.d.timepickerIsActive = true;

                this[name] = $target.val();
                this._updateCurrentTime();
                this.d._trigger('timeChange', [this.hours, this.minutes]);

                this._handleDate(this.d.lastSelectedDate);
                this.update()
            },

            _onSelectDate: function (e, data) {
                this._handleDate(data);
                this.update();
            },

            _onMouseEnterRange: function (e) {
                let name = $(e.target).attr('name');
                $('.datepicker--time-current-' + name, this.$timepicker).addClass('-focus-');
            },

            _onMouseOutRange: function (e) {
                let name = $(e.target).attr('name');
                if (this.d.inFocus) return; // Prevent removing focus when mouse out of range slider
                $('.datepicker--time-current-' + name, this.$timepicker).removeClass('-focus-');
            },

            _onMouseUpRange: function (e) {
                this.d.timepickerIsActive = false;
            }
        };
    })();
})(window, jQuery);