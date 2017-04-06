ANDESITE.JS
=====
Yet another generic MVVM library!

## Example App ##
index.html
```html
<head>
	<title>Andesite Example</title>
<head>
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
    $a.ready(() => {
        $('#b').on('click', () => $a.msgBus.post({type: 'button'}));
    });
</script>
```
static/component/button.html
```html
<button>${param}</button>
```
