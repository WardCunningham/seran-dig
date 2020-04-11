FROM docker.pkg.github.com/wardcunningham/seran-wiki/seran-wiki:latest
RUN --update --no-cache graphviz ttf-freefont
ADD . /seran-dig
CMD ["--port=80:8000", "../seran-dig/dig.ts"]
