<?php

namespace common\widgets\datepicker;

use yii\helpers\Html;
use yii\helpers\Json;
use yii\widgets\InputWidget;

class DatePicker extends InputWidget
{
    public $language = 'en';

    // Picker date format in moment format.
    // if null format gets from locale
    // https://momentjs.com/docs/#/displaying/format/
    public $pickerFormat = null;
    public $pickerFormatRegx = null; // Used to check manual input

    public $pickerTimeFormat = null;
    public $pickerTimeFormatRegx = null; // Used to check manual input

    public $mirror = true;
    public $mirrorFormat = 'YYYY-MM-DD';
    public $mirrorTimeFormat = 'HH:mm:00';

    public $timepicker = false;
    public $onlyTimepicker = false;

    public $readonly = false;

    public $options = [];

    // see at http://t1m0n.name/air-datepicker/docs/index-ru.html
    public $clientOptions = [
        'toggleSelected' => false,
        'keyboardNav' => false,
        'autoClose' => true,
        'position' => 'bottom right',
    ];

    // see at http://t1m0n.name/air-datepicker/docs/index-ru.html
    public $clientEvents = [];


    public function init()
    {
        parent::init();
        Html::addCssClass($this->options, ['form-control', 'with-datepicker']);
    }

    private function registerAssets()
    {
        DatePickerAsset::register($this->view);

        // Include locale
        if (isset($this->language) && ($this->language !== 'en')) {
            $this->clientOptions['language'] = $this->language;

            $dpBundle = $this->view->assetManager->getBundle(DatePickerAsset::class);
            $this->view->registerJsFile($dpBundle->baseUrl . "/js/i18n/datepicker.{$this->language}.js", [
                'depends' => DatePickerAsset::class,
            ]);
        }
    }

    public function run()
    {
        $output = '';

        $this->registerAssets();

        $id = $this->options['id'];

        // Create hidden input
        if ($this->mirror) {
            $mirrorId = $id . '-mirror';
            $output .= $this->hasModel() ?
                Html::activeHiddenInput($this->model, $this->attribute, ['id' => $mirrorId]) :
                Html::hiddenInput($this->name, $this->value, ['id' => $mirrorId]);

            $this->clientOptions['altField'] = '#' . $mirrorId;
            $this->clientOptions['altFieldDateFormat'] = $this->mirrorFormat;

            $this->options['name'] = '';
        }

        if ($this->readonly) {
            $this->options['readonly'] = true;
            $this->clientOptions['manualInput'] = false;
        }

        // Setup date formats
        if ($this->pickerFormat) {
            $this->clientOptions['dateFormat'] = $this->pickerFormat;
            $this->clientOptions['dateFormatRegx'] = $this->pickerFormatRegx;
        }

        // With timepicker
        if ($this->timepicker) {
            $this->clientOptions['timepicker'] = true;
            $this->clientOptions['onlyTimepicker'] = $this->onlyTimepicker;

            if ($this->clientOptions['altFieldDateFormat'])
                $this->clientOptions['altFieldDateFormat'] .= ' ' . $this->mirrorTimeFormat;

            if ($this->pickerTimeFormat)
                $this->clientOptions['timeFormat'] = $this->pickerTimeFormat;
                $this->clientOptions['timeFormatRegx'] = $this->pickerTimeFormatRegx;
        }

        // Initialisation JS
        $pickerInit = Json::encode($this->clientOptions);
        $js = "jQuery('#$id').datepicker($pickerInit)";
        foreach ($this->clientEvents as $event => $handler) {
            $js .= ".data('datepicker').$event($handler)";
        }
        $this->view->registerJs($js . ';');

        $output .= $this->hasModel()
            ? Html::activeTextInput($this->model, $this->attribute, $this->options)
            : Html::textInput('', $this->value, $this->options);

        return $output;
    }
}