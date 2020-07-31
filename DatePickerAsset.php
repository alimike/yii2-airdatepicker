<?php

namespace common\widgets\datepicker;

use common\assets\MomentAsset;
use common\assets\MomentTZAsset;
use yii\web\AssetBundle;
use yii\web\JqueryAsset;

class DatePickerAsset extends AssetBundle
{
    public $sourcePath = '@common/widgets/datepicker/assets';
    public $css = [
        'css/datepicker.min.css',
    ];
    public $js = [
        'js/datepicker.js',
    ];
    public $depends = [
        JqueryAsset::class,
        MomentAsset::class,
        MomentTZAsset::class,
    ];
}
