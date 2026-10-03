# 深圳出片地图：GitHub 发布指南

这份指南适合第一次发布 GitHub 项目使用。当前项目已经是一个可以部署到 GitHub Pages 的纯静态网站，不需要 Workbuddy，也不需要后端服务器。

## 一、先在 GitHub 创建空仓库

1. 用 Chrome 打开并登录 [GitHub](https://github.com)。
2. 点击右上角 `+` → `New repository`。
3. 仓库名填写：`shenzhen-photo-map`。
4. 选择 `Public`，方便面试官直接查看。
5. **不要勾选** `Add a README file`、`.gitignore` 或许可证，因为本地项目已经有这些文件。
6. 点击 `Create repository`。

创建后，GitHub 页面会显示一个仓库地址，形式类似：

```text
https://github.com/你的用户名/shenzhen-photo-map.git
```

## 二、把本地项目推送到 GitHub

打开 PowerShell，逐行执行下面的命令。路径中有中文和空格，必须保留双引号。

```powershell
cd "C:\Users\森\Desktop\新建文件夹 (3)\出片地图-源码"
git status
git add .
git commit -m "feat: publish photo spot map demo"
git remote add origin https://github.com/你的用户名/shenzhen-photo-map.git
git push -u origin main
```

把 `你的用户名` 替换成你的 GitHub 用户名。

如果 GitHub 要求登录：

- 用户名填写 GitHub 用户名；
- 密码位置不要填写 GitHub 登录密码；
- 如果弹出浏览器登录或授权窗口，按提示确认即可；
- 如果提示需要 token，使用 GitHub 的 Personal access token 作为密码。

如果出现 `remote origin already exists`，执行：

```powershell
git remote set-url origin https://github.com/你的用户名/shenzhen-photo-map.git
git push -u origin main
```

## 三、开启 GitHub Pages

1. 打开仓库页面，进入 `Settings`。
2. 左侧进入 `Pages`。
3. 在 `Build and deployment` 中选择：
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - 文件夹：`/ (root)`
4. 点击 `Save`。
5. 等待一两分钟，刷新页面。

访问地址通常是：

```text
https://你的用户名.github.io/shenzhen-photo-map/
```

## 四、为什么 GitHub Pages 可以直接打开

直接双击 `index.html` 时，浏览器使用的是 `file://` 协议。页面虽然能打开，但浏览器会阻止它读取旁边的 `spots.json` 和 `metro.json`，所以出现“数据加载失败”。

GitHub Pages 使用的是 `https://`，会像正常网站一样提供 HTML、JSON、JavaScript 和图片文件，因此其他人直接打开 Pages 地址即可使用，不需要 Workbuddy，也不需要安装 Python 或 Node。

本地预览仍然需要启动服务：

```powershell
npm start
```

或者双击 `启动地图.bat`。

## 五、发布前检查

在推送前可以执行：

```powershell
npm run check
npm run test:syntax
```

确认以下内容：

- 仓库中没有 API Key、密码或个人隐私信息；
- `spots.json`、`metro.json`、`assets/photos/` 都被提交；
- GitHub Pages 地址能正常打开；
- 点位图片、搜索、计划页和导航链接都能使用。

## 六、图片存储策略

当前项目采用混合方式：

1. `spots.json` 中保留原始图片外链；
2. 外链加载失败时，自动回退到 `assets/photos/` 内的本地图片；
3. GitHub Pages 发布后，本地图片会随仓库一起发布；
4. 未来社区上传图片时，再接对象存储或图床，不建议把大量用户原图永久塞进 Git 仓库。

MiriaGo 的思路可以借鉴：远程保存或读取参考图，客户端保存缩略图和用户明确选择的完整图片；计划或导出包可以携带本地资源。你的项目可以按“当前静态版 → 图片缓存 → 用户上传 → 对象存储/CDN”的顺序演进。
