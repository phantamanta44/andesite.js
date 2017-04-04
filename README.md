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
		$a.component('header');
		$a.component('button');
		$a.ready(() =>
			$("#button").on("click", () =>
				$("#header").attr.subtitle = "Poking is rude!"
			)
		);
	</script>
	<a-header id="header" title="Hello, world!" subtitle="This is an example of Andesite!"></a-header>
	<a-button id="button">Press Me!</a-button>
</body>
```
static/component/header.html
```html
<h1>${title}</h1>
<p>${subtitle}</p>
```
static/component/button.html
```html
<button>${param}</button>
```
