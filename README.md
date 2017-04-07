ANDESITE.JS
=====
Yet another generic MVVM library!

## Example App ##
index.html
```html
<head>
	<title>Andesite Example</title>
</head>
<body>
	<script src="../andesite.js"></script>
	<script>
        $a.component('button', 'app');
        $a.msgBus.on('button', () => $('#app').attr.subtitle = 'Poking is rude!');
	</script>
	<a-app title="Hello, world!" subtitle="This is an example of Andesite!" id="app"></a-app>
</body>
```
static/component/app.html
```html
<h1>${attr.title}</h1>
<p>${attr.subtitle}</p>
<a-button id="b">Press me!</a-button>
<script>
    $('#b').on('click', () => $a.msgBus.post({type: 'button'}));
</script>
<hr>

<p>${text}</p>
<input type="text" a-bind="text" value="Type something!">
<hr>

<p>Checkbox state: ${bool}</p>
<input type="checkbox" a-bind="bool">
<input type="checkbox" a-bind="bool">
<input type="checkbox" a-bind="bool">
<hr>

<input type="text" a-bind="toAdd">
<a-button id="add">Add</a-button>
<a-foreach a-in="list">
    <div class="list-elem">
        <p>${text}</p>
    </div>
</a-foreach>
<script>
    let add = $('#add');
    this.data.list = [];
    add.on('click', () => {
        this.data.list.push({text: this.data.toAdd});
        this.data.toAdd = "";
    });
</script>
```
static/component/button.html
```html
<div id="b">${param}</div>
<style>
    #b {
        display: inline-block;
        position: relative;
        top: 0;
        padding: 9px 16px;
        background-color: #2196F3;
        color: rgba(255, 255, 255, 0.87);
        border-radius: 2px;
        box-shadow: 0 3px 8px -4px #000;
        user-select: none;
        cursor: pointer;
    }

    #b:active {
        top: 2px;
    }
</style>
```
